import { of, throwError } from 'rxjs';
import { render, screen } from 'test/test-utils';

import { createDataFrame, FieldType, type PluginMeta } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import {
  computeHealth,
  fetchKubernetesOverview,
  type KubernetesOverview,
  KubernetesOverviewCard,
} from './KubernetesOverviewCard';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  usePluginBridge: jest.fn(),
  canAccessPluginPage: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockCanAccessPluginPage = jest.mocked(canAccessPluginPage);
const mockGetDataSourceSrv = jest.mocked(getDataSourceSrv);

// canAccessPluginPage is mocked, so only the truthiness of settings matters to the access gate.
const SETTINGS = { includes: [] } as unknown as PluginMeta;

const query = jest.fn();

// One single-value instant frame per refId, mirroring a Prometheus instant query response.
function makeFrame(refId: string, value: number) {
  return createDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      { name: 'Value', type: FieldType.number, values: [value] },
    ],
  });
}

// Build the response frames from a partial refId -> scalar map; omitted refIds yield no frame
// (the "metric absent" case).
function frames(values: Partial<Record<string, number>>) {
  return Object.entries(values).map(([refId, v]) => makeFrame(refId, v as number));
}

// Default list: one default Prometheus datasource. Tests override to exercise the no-Prometheus path.
function setDataSources(
  list: Array<{ uid: string; isDefault?: boolean; type?: string }> = [
    { uid: 'prom', isDefault: true, type: 'prometheus' },
  ]
) {
  mockGetDataSourceSrv.mockReturnValue({
    getList: () => list,
    get: async () => ({ query }),
  } as unknown as ReturnType<typeof getDataSourceSrv>);
}

beforeEach(() => {
  // Default: plugin installed, access granted, one Prometheus datasource, empty result. Tests override.
  mockUsePluginBridge.mockReturnValue({ loading: false, installed: true, settings: SETTINGS });
  mockCanAccessPluginPage.mockReturnValue(true);
  query.mockReset();
  query.mockReturnValue(of({ data: [] }));
  setDataSources();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('KubernetesOverviewCard', () => {
  it('renders nothing when the Kubernetes app is not installed', () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false });

    const { container } = render(<KubernetesOverviewCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the plugin availability is still loading', () => {
    mockUsePluginBridge.mockReturnValue({ loading: true });

    const { container } = render(<KubernetesOverviewCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the overview counts and CTA, with health signals hidden when those metrics are absent', async () => {
    query.mockReturnValue(of({ data: frames({ clusters: 4, pods: 247 }) }));

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('247')).toBeInTheDocument();
    expect(screen.getByText('pods')).toBeInTheDocument();
    expect(screen.getByText('4 clusters')).toBeInTheDocument();

    // No health metrics in the response -> no badge, no insight rows.
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument();
    expect(screen.queryByText(/issue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pods healthy|pending or failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/restarts/i)).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /open kubernetes app/i })).toHaveAttribute(
      'href',
      '/a/grafana-k8s-app/home'
    );
  });

  it('shows a Healthy badge when no nodes are not-ready', async () => {
    query.mockReturnValue(of({ data: frames({ clusters: 1, pods: 10, notReadyNodes: 0 }) }));

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('All nodes ready')).toBeInTheDocument();
    expect(screen.queryByText(/issue/i)).not.toBeInTheDocument();
  });

  it('aggregates not-ready nodes into the status pill and a detail row', async () => {
    query.mockReturnValue(of({ data: frames({ clusters: 1, pods: 10, notReadyNodes: 2 }) }));

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('2 issues')).toBeInTheDocument();
    expect(screen.getByText('2 nodes not ready')).toBeInTheDocument();
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument();
  });

  it('renders a red verdict pill when pods are unhealthy', async () => {
    query.mockReturnValue(
      of({
        data: frames({
          clusters: 1,
          pods: 10,
          unhealthyPods: 3,
          notReadyNodes: 0,
          restarts1h: 0,
        }),
      })
    );

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('3 issues')).toBeInTheDocument();
    expect(screen.getByText('All nodes ready')).toBeInTheDocument();
    expect(screen.getByText('3 pods pending or failed')).toBeInTheDocument();
    expect(screen.getByText('No recent container restarts')).toBeInTheDocument();
  });

  it('surfaces container restarts in the status pill even when pods and nodes are fine', async () => {
    query.mockReturnValue(
      of({
        data: frames({
          clusters: 1,
          pods: 10,
          unhealthyPods: 0,
          notReadyNodes: 0,
          restarts1h: 5,
        }),
      })
    );

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('5 issues')).toBeInTheDocument();
    expect(screen.getByText('All nodes ready')).toBeInTheDocument();
    expect(screen.getByText('All pods healthy')).toBeInTheDocument();
    expect(screen.getByText('5 container restarts (1h)')).toBeInTheDocument();
  });

  it('shows a Healthy pill when every health signal is clear', async () => {
    query.mockReturnValue(
      of({
        data: frames({
          clusters: 1,
          pods: 10,
          unhealthyPods: 0,
          notReadyNodes: 0,
          restarts1h: 0,
        }),
      })
    );

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('All nodes ready')).toBeInTheDocument();
    expect(screen.getByText('All pods healthy')).toBeInTheDocument();
    expect(screen.getByText('No recent container restarts')).toBeInTheDocument();
  });

  it('shows healthy insight rows when unhealthy pods and restarts are zero', async () => {
    query.mockReturnValue(of({ data: frames({ clusters: 1, pods: 10, unhealthyPods: 0, restarts1h: 0 }) }));

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('All pods healthy')).toBeInTheDocument();
    expect(screen.getByText('No recent container restarts')).toBeInTheDocument();
  });

  it('shows warning insight rows when pods are unhealthy and containers restarted', async () => {
    query.mockReturnValue(of({ data: frames({ clusters: 1, pods: 10, unhealthyPods: 3, restarts1h: 5 }) }));

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('3 pods pending or failed')).toBeInTheDocument();
    expect(screen.getByText('5 container restarts (1h)')).toBeInTheDocument();
  });

  it('shows the empty state when no Kubernetes metrics are found', async () => {
    query.mockReturnValue(of({ data: [] }));

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('No Kubernetes metrics found.')).toBeInTheDocument();
    // No headline counts in the empty state.
    expect(screen.queryByText('pods')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the query fails, and retry refetches', async () => {
    query.mockReturnValueOnce(throwError(() => new Error('boom')));
    query.mockReturnValueOnce(of({ data: frames({ clusters: 4, pods: 247 }) }));

    const { user } = render(<KubernetesOverviewCard />);

    expect(await screen.findByText('Could not load Kubernetes data')).toBeInTheDocument();
    expect(screen.queryByText('No Kubernetes metrics found.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('247')).toBeInTheDocument();
  });

  it('shows an error (not a crash) when no Prometheus datasource is configured', async () => {
    setDataSources([]);

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('Could not load Kubernetes data')).toBeInTheDocument();
    expect(query).not.toHaveBeenCalled();
  });

  it('hides the CTA when the user cannot access the plugin page', async () => {
    mockCanAccessPluginPage.mockReturnValue(false);
    query.mockReturnValue(of({ data: frames({ clusters: 4, pods: 247 }) }));

    render(<KubernetesOverviewCard />);

    expect(await screen.findByText('247')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open kubernetes app/i })).not.toBeInTheDocument();
  });
});

describe('fetchKubernetesOverview', () => {
  it('returns parsed counts and null health signals when their frames are absent', async () => {
    query.mockReturnValue(of({ data: frames({ clusters: 4, pods: 247 }) }));

    await expect(fetchKubernetesOverview()).resolves.toEqual({
      clusters: 4,
      pods: 247,
      unhealthyPods: null,
      restarts1h: null,
      notReadyNodes: null,
    });
  });

  it('reads health signals when their frames are present', async () => {
    query.mockReturnValue(
      of({
        data: frames({
          clusters: 1,
          pods: 1,
          unhealthyPods: 3,
          restarts1h: 5,
          notReadyNodes: 2,
        }),
      })
    );

    await expect(fetchKubernetesOverview()).resolves.toMatchObject({
      unhealthyPods: 3,
      restarts1h: 5,
      notReadyNodes: 2,
    });
  });

  it('throws when no Prometheus datasource is configured', async () => {
    setDataSources([]);

    await expect(fetchKubernetesOverview()).rejects.toThrow('No prometheus datasource configured');
  });
});

describe('computeHealth', () => {
  const overview = (
    health: Pick<KubernetesOverview, 'unhealthyPods' | 'notReadyNodes' | 'restarts1h'>
  ): KubernetesOverview => ({ clusters: 1, pods: 1, ...health });

  it('returns null when no health signal is available', () => {
    expect(computeHealth(overview({ unhealthyPods: null, notReadyNodes: null, restarts1h: null }))).toBeNull();
  });

  it('is healthy when every signal is zero', () => {
    expect(computeHealth(overview({ unhealthyPods: 0, notReadyNodes: 0, restarts1h: 0 }))).toEqual({
      issues: 0,
      severity: 'healthy',
    });
  });

  it('is critical when pods are unhealthy', () => {
    expect(computeHealth(overview({ unhealthyPods: 3, notReadyNodes: 0, restarts1h: 0 }))).toEqual({
      issues: 3,
      severity: 'critical',
    });
  });

  it('is critical when nodes are not ready', () => {
    expect(computeHealth(overview({ unhealthyPods: 0, notReadyNodes: 2, restarts1h: 0 }))).toEqual({
      issues: 2,
      severity: 'critical',
    });
  });

  it('is a warning when only restarts are elevated', () => {
    expect(computeHealth(overview({ unhealthyPods: 0, notReadyNodes: 0, restarts1h: 5 }))).toEqual({
      issues: 5,
      severity: 'warning',
    });
  });

  it('sums all signals and stays critical when resources are bad', () => {
    expect(computeHealth(overview({ unhealthyPods: 3, notReadyNodes: 2, restarts1h: 5 }))).toEqual({
      issues: 10,
      severity: 'critical',
    });
  });

  it('treats null signals as zero in a partial metric set', () => {
    expect(computeHealth(overview({ unhealthyPods: 1, notReadyNodes: null, restarts1h: null }))).toEqual({
      issues: 1,
      severity: 'critical',
    });
  });
});
