import { render, screen } from 'test/test-utils';

import { createDataFrame, FieldType, type PluginMeta } from '@grafana/data';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { RecommendationExisting } from './RecommendationExisting';
import { fetchClusterCpuSeries, fetchKubernetesOverview, type KubernetesOverview } from './kubernetesData';
import { readSeries } from './promQuery';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  usePluginBridge: jest.fn(),
}));

jest.mock('./kubernetesData', () => ({
  ...jest.requireActual('./kubernetesData'),
  fetchKubernetesOverview: jest.fn(),
  fetchClusterCpuSeries: jest.fn(),
}));

const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockFetchOverview = jest.mocked(fetchKubernetesOverview);
const mockFetchCpuSeries = jest.mocked(fetchClusterCpuSeries);

// No `includes` entry for the bridge path means canAccessPluginPage grants access.
const settings = { id: 'grafana-k8s-app' } as PluginMeta<{}>;

const healthyOverview: KubernetesOverview = {
  clusters: 3,
  pods: 247,
  alertsFiring: null,
  unhealthyPods: 0,
  restarts1h: 0,
  notReadyNodes: 0,
};

beforeEach(() => {
  mockUsePluginBridge.mockReturnValue({ loading: false, installed: true, settings });
  mockFetchOverview.mockResolvedValue(healthyOverview);
  mockFetchCpuSeries.mockResolvedValue(null);
});

afterEach(() => jest.restoreAllMocks());

describe('RecommendationExisting', () => {
  it('opens the dropdown and switches the selected solution', async () => {
    const { user } = render(<RecommendationExisting />);

    const trigger = await screen.findByRole('button');
    const initialLabel = screen.getByRole('heading').textContent?.trim() ?? '';
    expect(initialLabel).not.toBe('');

    await user.click(trigger);

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems.length).toBeGreaterThan(1);

    const nextItem = menuItems.find((item) => (item.textContent?.trim() ?? '') !== initialLabel);
    expect(nextItem).toBeDefined();

    const nextLabel = nextItem?.textContent?.trim() ?? '';
    expect(nextLabel).not.toBe('');

    await user.click(nextItem!);

    expect(screen.getByRole('heading', { name: nextLabel })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: initialLabel })).not.toBeInTheDocument();
  });

  it('shows a skeleton instead of the stubs while the lookups are pending', () => {
    // Both fetches pending — no async state updates, so synchronous assertions are act-safe.
    const pending = Promise.race([]);
    mockFetchOverview.mockReturnValue(pending);
    mockFetchCpuSeries.mockReturnValue(pending);

    render(<RecommendationExisting />);

    expect(screen.getByTestId('recommendation-existing-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('shows the Kubernetes entry while the CPU series loads', async () => {
    mockFetchCpuSeries.mockReturnValue(Promise.race([]));

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByText('Cluster CPU · last 24h')).not.toBeInTheDocument();
  });

  it('resolves the skeleton straight to the Kubernetes entry without flashing a stub', async () => {
    render(<RecommendationExisting />);

    expect(screen.getByTestId('recommendation-existing-skeleton')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hosted Metrics' })).not.toBeInTheDocument();
  });

  it('shows the Kubernetes entry with live stats once the overview resolves', async () => {
    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.getByText('3 clusters')).toBeInTheDocument();
    expect(screen.getByText(/247 pods/)).toBeInTheDocument();
    // Healthy cluster — no alert strip.
    expect(screen.queryByText(/pods pending or failed/)).not.toBeInTheDocument();
    // No CPU series resolved — the sparkline block stays hidden.
    expect(screen.queryByText('Cluster CPU · last 24h')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open K8s app/ })).toHaveAttribute('href', '/a/grafana-k8s-app/home');
  });

  it('ceils fractional counts so partial numbers never render', async () => {
    mockFetchOverview.mockResolvedValue({
      clusters: 28.807541863863765,
      pods: 246.2,
      alertsFiring: 2.2,
      unhealthyPods: 0,
      restarts1h: 0,
      notReadyNodes: 0,
    });

    render(<RecommendationExisting />);

    expect(await screen.findByText('29 clusters')).toBeInTheDocument();
    expect(screen.getByText('247 pods')).toBeInTheDocument();
    // alertsFiring 2.2 gates the alert strip in (raw > 0) and displays ceiled.
    expect(screen.getByText('3 alerts firing')).toBeInTheDocument();
    expect(screen.queryByText(/28\.8/)).not.toBeInTheDocument();
  });

  it('renders the CPU sparkline caption when the series resolves', async () => {
    const frame = createDataFrame({
      refId: 'cpu',
      fields: [
        { name: 'Time', type: FieldType.time, values: [0, 1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [1, 2, 3] },
      ],
    });
    // Build the sparkline through readSeries — the production path — so the fixture carries the
    // y.state.range that uPlot's getYRange destructures.
    mockFetchCpuSeries.mockResolvedValue(readSeries([frame], 'cpu'));

    render(<RecommendationExisting />);

    expect(await screen.findByText('Cluster CPU · last 24h')).toBeInTheDocument();
  });

  it('shows an alert strip when the cluster reports problems', async () => {
    mockFetchOverview.mockResolvedValue({
      clusters: 3,
      pods: 247,
      alertsFiring: null,
      unhealthyPods: 2,
      restarts1h: 14,
      notReadyNodes: null,
    });

    render(<RecommendationExisting />);

    expect(await screen.findByText('2 pods pending or failed')).toBeInTheDocument();
    expect(screen.getByText(/14 restarts in the last hour/)).toBeInTheDocument();
  });

  it('leads the alert strip with the firing-alert count when Prometheus reports one', async () => {
    mockFetchOverview.mockResolvedValue({
      clusters: 3,
      pods: 247,
      alertsFiring: 2,
      unhealthyPods: 0,
      restarts1h: 14,
      notReadyNodes: 0,
    });

    render(<RecommendationExisting />);

    expect(await screen.findByText('2 alerts firing')).toBeInTheDocument();
    expect(screen.getByText(/14 restarts in the last hour/)).toBeInTheDocument();
    // The strip's View drills into the app's alerts page, not the app home.
    expect(screen.getByRole('link', { name: /View/ })).toHaveAttribute('href', '/a/grafana-k8s-app/alerts');
  });

  it('falls back to the stubbed solutions when no clusters resolve', async () => {
    mockFetchOverview.mockResolvedValue({ ...healthyOverview, clusters: 0 });

    const { user } = render(<RecommendationExisting />);

    const trigger = await screen.findByRole('button');
    await user.click(trigger);

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.queryByText('Kubernetes Monitoring')).not.toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });
});
