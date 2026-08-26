import { act, render, screen, waitFor } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { type AppPluginConfig } from '@grafana/runtime';
import { useAppPluginMetas } from '@grafana/runtime/internal';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';

import { ctaClicked } from '../analytics/main';
import { type SignalStatus } from '../solutions/solutionState';
import { type Solution, type SolutionId } from '../solutions/types';

import { RecommendationExisting } from './RecommendationExisting';

jest.mock('../analytics/main', () => ({ ctaClicked: jest.fn() }));
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useAppPluginMetas: jest.fn(),
}));

const mockCtaClicked = jest.mocked(ctaClicked);
const mockUseAppPluginMetas = jest.mocked(useAppPluginMetas);

const datasource: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
};

function solution(
  id: SolutionId,
  {
    status = 'inactive',
    data = null,
    ...overrides
  }: Partial<Solution> & {
    status?: SignalStatus;
    data?: DataSourceInstanceListItem | null;
  } = {}
): Solution {
  return {
    id,
    title: id,
    icon: 'chart-line',
    signal: async () => status,
    datasource: async () => data,
    needsAttention: async () => false,
    stats: async () => null,
    refinedStats: async () => null,
    sparkline: async () => null,
    cta: async () => null,
    alert: async () => null,
    offer: async () => null,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockCtaClicked.mockClear();
  mockUseAppPluginMetas.mockReturnValue({
    loading: false,
    error: undefined,
    value: [] as AppPluginConfig[],
  });
  document.addEventListener('click', interceptLinkClicks);
});

afterEach(() => {
  document.removeEventListener('click', interceptLinkClicks);
});

describe('RecommendationExisting', () => {
  it('does not let an inactive solution datasource block choosing the active solution', async () => {
    const logsDatasource = jest.fn(() => new Promise<DataSourceInstanceListItem | null>(() => {}));
    const selection = jest.fn();
    const metrics = solution('metrics', { status: 'active', data: datasource, title: 'Metrics' });
    const logs = solution('logs', {
      status: 'inactive',
      title: 'Logs',
      datasource: logsDatasource,
    });

    render(<RecommendationExisting solutions={[metrics, logs]} onSelectionChange={selection} />);

    expect(await screen.findByRole('heading', { name: 'Metrics' })).toBeInTheDocument();
    expect(selection).toHaveBeenLastCalledWith('metrics');
    expect(logsDatasource).not.toHaveBeenCalled();
  });

  it('lists only live solutions and lets the user switch between them', async () => {
    const kubernetes = solution('kubernetes', {
      status: 'active',
      data: datasource,
      title: 'Kubernetes Monitoring',
      icon: 'kubernetes',
    });
    const metrics = solution('metrics', {
      status: 'active',
      data: datasource,
      title: 'Metrics & infrastructure',
    });
    const logs = solution('logs', { status: 'inactive', title: 'Logs' });
    const { user } = render(<RecommendationExisting solutions={[kubernetes, metrics, logs]} />);

    expect(await screen.findByRole('heading', { name: kubernetes.title })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /switch solution/i }));
    expect(screen.getByRole('menuitem', { name: kubernetes.title })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: metrics.title })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: logs.title })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: metrics.title }));
    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(mockCtaClicked).toHaveBeenCalledWith({
      surface: 'existing_solution',
      action: 'switch_solution',
      placement: 'card',
      solution: 'metrics',
    });
  });

  it('clears the previous solution facts while the newly selected solution loads', async () => {
    const logsStats = deferred<{ primary: string } | null>();
    const logsAlert = deferred<{ primary: string } | null>();
    const kubernetes = solution('kubernetes', {
      status: 'active',
      data: datasource,
      title: 'Kubernetes Monitoring',
      stats: async () => ({ primary: '247 pods' }),
      alert: async () => ({ primary: 'Kubernetes alert' }),
    });
    const logs = solution('logs', {
      status: 'active',
      data: datasource,
      title: 'Logs',
      stats: () => logsStats.promise,
      alert: () => logsAlert.promise,
    });
    const { user } = render(<RecommendationExisting solutions={[kubernetes, logs]} />);

    expect(await screen.findByText('247 pods')).toBeInTheDocument();
    expect(await screen.findByText('Kubernetes alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: logs.title }));

    expect(await screen.findByRole('heading', { name: logs.title })).toBeInTheDocument();
    expect(screen.queryByText('247 pods')).not.toBeInTheDocument();
    expect(screen.queryByText('Kubernetes alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('solution-stats-skeleton')).toBeInTheDocument();
  });

  it('streams optional facts into an already-selected card', async () => {
    const stats = deferred<{ primary: string } | null>();
    const metrics = solution('metrics', {
      status: 'active',
      data: datasource,
      title: 'Metrics & infrastructure',
      stats: () => stats.promise,
      cta: async () => ({ label: 'Open Metrics Drilldown', href: '/a/metrics', action: 'open_solution' }),
    });

    render(<RecommendationExisting solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.queryByText('4.2 M series')).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open Metrics Drilldown' })).toBeInTheDocument();

    await act(async () => stats.resolve({ primary: '4.2 M series' }));
    expect(await screen.findByText('4.2 M series')).toBeInTheDocument();
    expect(screen.getByText('via Prometheus')).toBeInTheDocument();
  });

  it('keeps the card and clears its skeletons when optional facts reject', async () => {
    const reject = async () => {
      throw new Error('optional query failed');
    };
    const metrics = solution('metrics', {
      status: 'active',
      data: datasource,
      title: 'Metrics & infrastructure',
      stats: reject,
      refinedStats: reject,
      sparkline: reject,
      cta: reject,
      alert: reject,
    });
    const { container } = render(<RecommendationExisting solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('.react-loading-skeleton')).toHaveLength(0));
    expect(screen.queryByRole('link', { name: /Open/ })).not.toBeInTheDocument();
  });

  it('renders and tracks the selected solution alert action', async () => {
    const metrics = solution('metrics', {
      status: 'active',
      data: datasource,
      title: 'Metrics & infrastructure',
      alert: async () => ({
        primary: '3 hosts above 90% disk',
        details: ['db-01 at 96%', '~6 h to full'],
      }),
      cta: async () => ({
        label: 'Investigate disk usage',
        href: '/explore?left=disk',
        action: 'view_alerts',
      }),
    });
    const { user } = render(<RecommendationExisting solutions={[metrics]} />);

    expect(await screen.findByText('db-01 at 96%')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    await user.click(screen.getByRole('link', { name: 'Investigate disk usage' }));

    expect(mockCtaClicked).toHaveBeenCalledWith({
      surface: 'existing_solution',
      action: 'view_alerts',
      placement: 'card',
      solution: 'metrics',
    });
  });

  it.each([
    {
      name: 'empty',
      status: 'inactive' as const,
      heading: 'No data flowing yet',
      description: /Connect a data source to light up/,
    },
    {
      name: 'unknown',
      status: 'unknown' as const,
      heading: "We couldn't confirm your data",
      description: /We couldn't confirm live data yet/,
    },
  ])('renders the $name no-data state from settled signals', async ({ status, heading, description }) => {
    render(<RecommendationExisting solutions={[solution('metrics', { status })]} />);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it('settles into the inconclusive state when required getters reject', async () => {
    const metrics = solution('metrics', {
      datasource: async () => {
        throw new Error('datasource lookup failed');
      },
      signal: async () => {
        throw new Error('signal lookup failed');
      },
    });

    render(<RecommendationExisting solutions={[metrics]} />);

    expect(await screen.findByText(/We couldn't confirm live data yet/)).toBeInTheDocument();
    expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument();
  });

  it('tracks the selected solution action', async () => {
    const metrics = solution('metrics', {
      status: 'active',
      data: datasource,
      title: 'Metrics & infrastructure',
      cta: async () => ({ label: 'Open Metrics Drilldown', href: '/a/metrics', action: 'open_solution' }),
    });
    const { user } = render(<RecommendationExisting solutions={[metrics]} />);

    await user.click(await screen.findByRole('link', { name: 'Open Metrics Drilldown' }));

    expect(mockCtaClicked).toHaveBeenCalledWith({
      surface: 'existing_solution',
      action: 'open_solution',
      placement: 'card',
      solution: 'metrics',
    });
  });

  it('does not track re-selecting the current solution', async () => {
    const metrics = solution('metrics', {
      status: 'active',
      data: datasource,
      title: 'Metrics & infrastructure',
    });
    const { user } = render(<RecommendationExisting solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: metrics.title }));

    expect(mockCtaClicked).not.toHaveBeenCalled();
  });

  it('does not restart required detection when optional facts update', async () => {
    const stats = deferred<{ primary: string } | null>();
    const signal = jest.fn(async () => 'active' as const);
    const getDatasource = jest.fn(async () => datasource);
    const metrics = solution('metrics', { signal, datasource: getDatasource, stats: () => stats.promise });

    render(<RecommendationExisting solutions={[metrics]} />);
    await waitFor(() => expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument());
    const requiredReads = { signal: signal.mock.calls.length, datasource: getDatasource.mock.calls.length };

    await act(async () => stats.resolve({ primary: 'ready' }));
    await screen.findByText('ready');

    expect(signal).toHaveBeenCalledTimes(requiredReads.signal);
    expect(getDatasource).toHaveBeenCalledTimes(requiredReads.datasource);
  });
});
