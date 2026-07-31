import { render, screen } from 'test/test-utils';

import { createDataFrame, FieldType, type DataSourceInstanceListItem, type PluginMeta } from '@grafana/data';
import { type AppPluginConfig } from '@grafana/runtime';
import { useAppPluginMetas } from '@grafana/runtime/internal';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { ctaClicked } from '../analytics/main';

import { RecommendationExisting } from './RecommendationExisting';
import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
  type KubernetesHealth,
  type KubernetesInventory,
} from './kubernetesData';
import { readSeries } from './promQuery';
import { useSolutionState } from './solutionState';
import { type SolutionState } from './solutionsMatrix';
import { fetchLogsActivity, fetchMetricsActivity, fetchTracesActivity, fetchTracesServices } from './telemetryData';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  usePluginBridge: jest.fn(),
}));

jest.mock('./kubernetesData', () => ({
  ...jest.requireActual('./kubernetesData'),
  resolveKubernetesDatasource: jest.fn(),
  fetchKubernetesInventory: jest.fn(),
  fetchKubernetesHealth: jest.fn(),
  fetchClusterCpuSeries: jest.fn(),
}));

jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
}));

jest.mock('./solutionState', () => ({
  useSolutionState: jest.fn(),
}));

jest.mock('./telemetryData', () => ({
  ...jest.requireActual('./telemetryData'),
  fetchLogsActivity: jest.fn(),
  fetchMetricsActivity: jest.fn(),
  fetchTracesActivity: jest.fn(),
  fetchTracesServices: jest.fn(),
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useAppPluginMetas: jest.fn(),
}));

const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockResolveDatasource = jest.mocked(resolveKubernetesDatasource);
const mockFetchInventory = jest.mocked(fetchKubernetesInventory);
const mockFetchHealth = jest.mocked(fetchKubernetesHealth);
const mockFetchCpuSeries = jest.mocked(fetchClusterCpuSeries);
const mockUseSolutionState = jest.mocked(useSolutionState);
const mockUseAppPluginMetas = jest.mocked(useAppPluginMetas);
const mockFetchLogsActivity = jest.mocked(fetchLogsActivity);
const mockFetchMetricsActivity = jest.mocked(fetchMetricsActivity);
const mockFetchTracesActivity = jest.mocked(fetchTracesActivity);
const mockFetchTracesServices = jest.mocked(fetchTracesServices);

const settings = { id: 'grafana-k8s-app' } as PluginMeta<{}>;
const datasource: DataSourceInstanceListItem = {
  uid: 'k8s-uid',
  name: 'k8s-prom',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: false,
};

const lokiDatasource: DataSourceInstanceListItem = {
  uid: 'loki-uid',
  name: 'grafanacloud-logs',
  type: 'loki',
  meta: { id: 'loki' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: false,
};

const tempoDatasource: DataSourceInstanceListItem = {
  uid: 'tempo-uid',
  name: 'grafanacloud-traces',
  type: 'tempo',
  meta: { id: 'tempo' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: false,
};

const prometheusDatasource: DataSourceInstanceListItem = {
  uid: 'prom-uid',
  name: 'grafanacloud-prom',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: false,
};

function setSolutionState(
  overrides: Partial<SolutionState>,
  ds: {
    loki?: DataSourceInstanceListItem;
    tempo?: DataSourceInstanceListItem;
    prometheus?: DataSourceInstanceListItem;
  } = {}
) {
  mockUseSolutionState.mockReturnValue({
    value: {
      state: {
        metrics: 'inactive',
        logs: 'inactive',
        traces: 'inactive',
        kubernetes: 'inactive',
        spanMetrics: 'inactive',
        ...overrides,
      },
      lokiDatasource: ds.loki ?? null,
      tempoDatasource: ds.tempo ?? null,
      prometheusDatasource: ds.prometheus ?? null,
    },
    loading: false,
  });
}

function mockActiveLogs() {
  setSolutionState({ metrics: 'active', logs: 'active' }, { loki: lokiDatasource });
  mockFetchLogsActivity.mockResolvedValue({ bytes: 47_000_000_000, sources: 8, series: null });
}

function mockActiveTraces() {
  setSolutionState({ metrics: 'active', logs: 'active', traces: 'active' }, { tempo: tempoDatasource });
  mockFetchTracesActivity.mockResolvedValue({ spans: 4_800_000, series: null });
  mockFetchTracesServices.mockResolvedValue(34);
}

const healthyInventory: KubernetesInventory = { clusters: 3, pods: 247 };
const healthyHealth: KubernetesHealth = {
  alertsFiring: null,
  unhealthyPods: 0,
  restarts1h: 0,
  notReadyNodes: 0,
};

function mockResolvedKubernetes(
  inventory: KubernetesInventory = healthyInventory,
  health: KubernetesHealth = healthyHealth
) {
  mockResolveDatasource.mockResolvedValue(datasource);
  mockFetchInventory.mockResolvedValue(inventory);
  mockFetchHealth.mockResolvedValue(health);
  mockFetchCpuSeries.mockResolvedValue(null);
}

beforeEach(() => {
  mockUsePluginBridge.mockReturnValue({ loading: false, installed: true, settings });
  mockResolvedKubernetes();
  mockResolveDatasource.mockClear();
  mockFetchInventory.mockClear();
  mockFetchHealth.mockClear();
  mockFetchCpuSeries.mockClear();
  jest.mocked(ctaClicked).mockClear();
  mockUseSolutionState.mockReset();
  setSolutionState({});
  mockUseAppPluginMetas.mockReturnValue({ loading: false, error: undefined, value: [] });
  mockFetchLogsActivity.mockReset();
  mockFetchLogsActivity.mockResolvedValue({ bytes: null, sources: null, series: null });
  mockFetchTracesActivity.mockReset();
  mockFetchTracesActivity.mockResolvedValue({ spans: null, series: null });
  mockFetchTracesServices.mockReset();
  mockFetchTracesServices.mockResolvedValue(null);
  mockFetchMetricsActivity.mockReset();
  mockFetchMetricsActivity.mockResolvedValue({
    series: null,
    dataPointsPerMinute: null,
    names: null,
    hosts: null,
    seriesSparkline: null,
    disk: null,
  });
});

afterEach(() => jest.restoreAllMocks());

describe('RecommendationExisting', () => {
  it('opens the dropdown and switches the selected solution', async () => {
    mockActiveLogs();
    const { user } = render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Logs' }));

    expect(screen.getByRole('heading', { name: 'Hosted Logs' })).toBeInTheDocument();
    expect(await screen.findByText('47 GB')).toBeInTheDocument();
    expect(screen.getByText('ingested · 7d · ~8 sources')).toBeInTheDocument();
  });

  it('lists live solutions in registry order with no stub entries', async () => {
    mockActiveLogs();
    mockFetchMetricsActivity.mockResolvedValue({
      series: 4_200_000,
      dataPointsPerMinute: null,
      names: null,
      hosts: null,
      seriesSparkline: null,
      disk: null,
    });
    mockFetchTracesActivity.mockResolvedValue({ spans: 4_800_000, series: null });
    mockFetchTracesServices.mockResolvedValue(34);
    setSolutionState(
      { metrics: 'active', logs: 'active', traces: 'active' },
      { prometheus: prometheusDatasource, loki: lokiDatasource, tempo: tempoDatasource }
    );

    const { user } = render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));

    const items = screen.getAllByRole('menuitem').map((item) => item.textContent?.trim());
    expect(items).toEqual(['Kubernetes Monitoring', 'Metrics & infrastructure', 'Hosted Logs', 'Hosted Traces']);
  });

  it('shows traces stats and the drilldown href when the app is available', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    mockActiveTraces();
    mockUseAppPluginMetas.mockReturnValue({
      loading: false,
      error: undefined,
      value: [{ id: 'grafana-exploretraces-app' } as AppPluginConfig],
    });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Hosted Traces' })).toBeInTheDocument();
    expect(screen.getByText('via grafanacloud-traces')).toBeInTheDocument();
    expect(await screen.findByText('4.80 Mil spans')).toBeInTheDocument();
    expect(screen.getByText('traced · 24h · 34 services')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Traces Drilldown/ })).toHaveAttribute(
      'href',
      '/a/grafana-exploretraces-app'
    );
  });

  it('falls back to Explore while the app lookup is pending or the app is absent', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    mockActiveLogs();
    mockUseAppPluginMetas.mockReturnValue({ loading: true, error: undefined, value: undefined });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Hosted Logs' })).toBeInTheDocument();
    const href = screen.getByRole('link', { name: /Open in Explore/ }).getAttribute('href') ?? '';
    expect(href).toMatch(/^\/explore\?left=/);
    const left = new URLSearchParams(href.split('?')[1]).get('left') ?? '';
    expect(JSON.parse(left)).toEqual({ datasource: 'grafanacloud-logs', context: 'explore' });
  });

  it('links the logs entry into Logs Drilldown when the app is available', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    mockActiveLogs();
    mockUseAppPluginMetas.mockReturnValue({
      loading: false,
      error: undefined,
      value: [{ id: 'grafana-lokiexplore-app' } as AppPluginConfig],
    });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Hosted Logs' })).toBeInTheDocument();
    expect(screen.getByText('via grafanacloud-logs')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Explore \(Logs\)/ })).toHaveAttribute(
      'href',
      '/a/grafana-lokiexplore-app'
    );
  });

  it('shows metrics stats, the disk alert, and the drilldown href when the app is available', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    setSolutionState({ metrics: 'active' }, { prometheus: prometheusDatasource });
    mockFetchMetricsActivity.mockResolvedValue({
      series: 4_200_000,
      dataPointsPerMinute: null,
      names: 1_200,
      hosts: 12,
      seriesSparkline: null,
      disk: { hostsAbove: 3, worstInstance: 'web-03:9100', worstRatio: 0.96, hoursToFull: 6.4 },
    });
    mockUseAppPluginMetas.mockReturnValue({
      loading: false,
      error: undefined,
      value: [{ id: 'grafana-metricsdrilldown-app' } as AppPluginConfig],
    });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Metrics & infrastructure' })).toBeInTheDocument();
    expect(screen.getByText('via grafanacloud-prom')).toBeInTheDocument();
    expect(await screen.findByText('4.20 Mil series')).toBeInTheDocument();
    expect(screen.getByText('active · 12 hosts')).toBeInTheDocument();
    expect(screen.getByText('3 hosts above 90% disk')).toBeInTheDocument();
    // Scrape port stripped from the worst host; the rounded ETA rides along.
    expect(screen.getByText('web-03 at 96%')).toBeInTheDocument();
    expect(screen.getByText('~6 h to full')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View/ }).getAttribute('href')).toMatch(/^\/explore\?left=/);
    expect(screen.getByRole('link', { name: /Open Metrics Drilldown/ })).toHaveAttribute(
      'href',
      '/a/grafana-metricsdrilldown-app'
    );
  });

  it('never rounds a sub-hour disk ETA down to zero', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    setSolutionState({ metrics: 'active' }, { prometheus: prometheusDatasource });
    mockFetchMetricsActivity.mockResolvedValue({
      series: 4_200_000,
      dataPointsPerMinute: null,
      names: null,
      hosts: 620,
      seriesSparkline: null,
      disk: { hostsAbove: 3, worstInstance: 'web-03:9100', worstRatio: 0.96, hoursToFull: 0.3 },
    });

    render(<RecommendationExisting />);

    expect(await screen.findByText('~1 h to full')).toBeInTheDocument();
  });

  it('shows the ingest rate as the metrics secondary when available', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    setSolutionState({ metrics: 'active' }, { prometheus: prometheusDatasource });
    mockFetchMetricsActivity.mockResolvedValue({
      series: 4_200_000,
      dataPointsPerMinute: 5_160_000,
      names: null,
      hosts: 12,
      seriesSparkline: null,
      disk: null,
    });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Metrics & infrastructure' })).toBeInTheDocument();
    expect(await screen.findByText(/data points\/min/)).toBeInTheDocument();
    // The ingest rate replaces the whole 'active · N hosts' secondary.
    expect(screen.queryByText(/^active/)).not.toBeInTheDocument();
  });

  it('falls back to the name count and Explore when no active-series source responded', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    setSolutionState({ metrics: 'active' }, { prometheus: prometheusDatasource });
    mockFetchMetricsActivity.mockResolvedValue({
      series: null,
      dataPointsPerMinute: null,
      names: 1_200,
      hosts: null,
      seriesSparkline: null,
      disk: null,
    });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Metrics & infrastructure' })).toBeInTheDocument();
    expect(await screen.findByText('1.20 K metrics')).toBeInTheDocument();
    // No host count: the secondary degrades to the bare qualifier, and no alert row renders.
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.queryByText(/above 90% disk/)).not.toBeInTheDocument();
    const href = screen.getByRole('link', { name: /Open in Explore/ }).getAttribute('href') ?? '';
    expect(href).toMatch(/^\/explore\?left=/);
    const left = new URLSearchParams(href.split('?')[1]).get('left') ?? '';
    expect(JSON.parse(left)).toEqual({ datasource: 'grafanacloud-prom', context: 'explore' });
  });

  it('drops the metrics entry when series, names, and sparkline all failed soft', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    setSolutionState({ metrics: 'active', logs: 'active' }, { prometheus: prometheusDatasource, loki: lokiDatasource });
    mockFetchLogsActivity.mockResolvedValue({ bytes: 47_000_000_000, sources: 8, series: null });
    // Hosts alone are secondary content — they cannot carry the card.
    mockFetchMetricsActivity.mockResolvedValue({
      series: null,
      dataPointsPerMinute: null,
      names: null,
      hosts: 12,
      seriesSparkline: null,
      disk: null,
    });

    const { user } = render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Hosted Logs' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));

    const items = screen.getAllByRole('menuitem').map((item) => item.textContent?.trim());
    expect(items).toEqual(['Hosted Logs']);
  });

  it('never invents an entry for an unknown signal', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    setSolutionState({ logs: 'unknown', traces: 'unknown' }, { loki: lokiDatasource, tempo: tempoDatasource });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Add more telemetry' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hosted Logs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hosted Traces' })).not.toBeInTheDocument();
    expect(mockFetchLogsActivity).not.toHaveBeenCalled();
    expect(mockFetchTracesActivity).not.toHaveBeenCalled();
  });

  it('uses the inconclusive copy when no signal is confirmed active', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    setSolutionState({ metrics: 'unknown', logs: 'unknown', traces: 'unknown', kubernetes: 'unknown' });

    render(<RecommendationExisting />);

    expect(await screen.findByText(/We couldn't confirm live data yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Some signals are already flowing/)).not.toBeInTheDocument();
  });

  it('drops an active entry when every detail fetch came back empty', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    setSolutionState(
      { metrics: 'active', logs: 'active', traces: 'active' },
      { loki: lokiDatasource, tempo: tempoDatasource }
    );
    // Signals are active but stats and sparklines all failed soft: a bare title card reads
    // as broken, so neither solution renders.
    mockFetchLogsActivity.mockResolvedValue({ bytes: null, sources: null, series: null });
    mockFetchTracesActivity.mockResolvedValue({ spans: null, series: null });
    mockFetchTracesServices.mockResolvedValue(34);

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Add more telemetry' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hosted Logs' })).not.toBeInTheDocument();
    // The services count alone renders nothing, so it cannot carry the traces card.
    expect(screen.queryByRole('heading', { name: 'Hosted Traces' })).not.toBeInTheDocument();
  });

  it('softens the no-data claim for a metrics-only org with nothing renderable', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    setSolutionState({ metrics: 'active' });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Add more telemetry' })).toBeInTheDocument();
    expect(screen.getByText(/Some signals are already flowing/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Connect a data source/ })).toBeInTheDocument();
  });

  it('keeps an entry whose sparkline failed but whose stats resolved', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    mockActiveLogs();

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Hosted Logs' })).toBeInTheDocument();
    expect(await screen.findByText('47 GB')).toBeInTheDocument();
  });

  it('shows a full-card skeleton while settings are pending', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: true, installed: true, settings: undefined });
    mockResolveDatasource.mockImplementation(() => new Promise(() => {}));
    mockFetchInventory.mockImplementation(() => new Promise(() => {}));
    mockFetchHealth.mockImplementation(() => new Promise(() => {}));
    mockFetchCpuSeries.mockImplementation(() => new Promise(() => {}));
    render(<RecommendationExisting />);

    expect(await screen.findByTestId('recommendation-existing-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
  });

  it('shows the no-data card immediately when settings are unavailable without awaiting resolution', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    mockResolveDatasource.mockImplementation(() => new Promise(() => {}));

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'No data flowing yet' })).toBeInTheDocument();
    expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument();
    expect(mockResolveDatasource).not.toHaveBeenCalled();
  });

  it('shows the no-data card and never queries Kubernetes when the app is installed but disabled', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'No data flowing yet' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
    expect(mockResolveDatasource).not.toHaveBeenCalled();
    expect(mockFetchInventory).not.toHaveBeenCalled();
  });

  it('keeps the skeleton (never the no-data card) when the plugin gate opens before the probe resolves', async () => {
    // Regression: on the render where the bridge settles, useAsync still carries the
    // disabled run's settled undefined — it must read as loading, not as settled empty.
    mockUsePluginBridge.mockReturnValue({ loading: true, installed: undefined, settings: undefined });
    let resolveProbe: (value: typeof datasource) => void = () => {};
    mockResolveDatasource.mockImplementation(() => new Promise((resolve) => (resolveProbe = resolve)));

    const { rerender } = render(<RecommendationExisting />);
    expect(await screen.findByTestId('recommendation-existing-skeleton')).toBeInTheDocument();

    mockUsePluginBridge.mockReturnValue({ loading: false, installed: true, settings });
    rerender(<RecommendationExisting />);

    expect(screen.getByTestId('recommendation-existing-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No data flowing yet' })).not.toBeInTheDocument();

    resolveProbe(datasource);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No data flowing yet' })).not.toBeInTheDocument();
  });

  it('shows the no-data card when resolution returns null', async () => {
    mockResolveDatasource.mockResolvedValue(null);
    mockFetchInventory.mockRejectedValue(new Error('No Prometheus datasource with Kubernetes data'));
    mockFetchHealth.mockRejectedValue(new Error('No Prometheus datasource with Kubernetes data'));

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'No data flowing yet' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hosted Logs' })).not.toBeInTheDocument();
  });

  it('shows the no-data card when resolution rejects without flashing the Kubernetes title', async () => {
    mockResolveDatasource.mockRejectedValue(new Error('probe failed'));

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'No data flowing yet' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
  });

  it('shows the Kubernetes title and alert strip while inventory is still pending', async () => {
    mockFetchInventory.mockImplementation(() => new Promise(() => {}));
    mockFetchHealth.mockResolvedValue({
      alertsFiring: 2,
      unhealthyPods: 1,
      restarts1h: 0,
      notReadyNodes: 0,
    });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.getByTestId('kubernetes-stats-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument();
    expect(screen.getByText(/alert/i)).toBeInTheDocument();
  });

  it('shows the card without stats when inventory rejects but health resolves', async () => {
    mockFetchInventory.mockRejectedValue(new Error('inventory failed'));
    mockFetchHealth.mockResolvedValue({
      alertsFiring: null,
      unhealthyPods: 2,
      restarts1h: 0,
      notReadyNodes: 0,
    });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.queryByTestId('kubernetes-stats-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByText('3 clusters')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open K8s app' })).toBeInTheDocument();
  });

  it('shows stats without an alert strip when health rejects but inventory resolves', async () => {
    mockFetchHealth.mockRejectedValue(new Error('health failed'));

    render(<RecommendationExisting />);

    expect(await screen.findByText('3 clusters')).toBeInTheDocument();
    expect(screen.queryByText(/alert firing/i)).not.toBeInTheDocument();
  });

  it('keeps the Kubernetes card when inventory and health both reject', async () => {
    mockFetchInventory.mockRejectedValue(new Error('inventory failed'));
    mockFetchHealth.mockRejectedValue(new Error('health failed'));

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.getByText('via k8s-prom')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open K8s app' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hosted Logs' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('kubernetes-stats-skeleton')).not.toBeInTheDocument();
  });

  it('shows a sparkline skeleton while CPU is pending', async () => {
    mockFetchCpuSeries.mockImplementation(() => new Promise(() => {}));

    render(<RecommendationExisting />);

    expect(await screen.findByTestId('kubernetes-sparkline-skeleton')).toBeInTheDocument();
  });

  it('omits the sparkline when CPU resolves null', async () => {
    mockFetchCpuSeries.mockResolvedValue(null);

    render(<RecommendationExisting />);

    expect(await screen.findByText('3 clusters')).toBeInTheDocument();
    expect(screen.queryByTestId('kubernetes-sparkline-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByText('Cluster CPU · last 24h')).not.toBeInTheDocument();
  });

  it('omits the stats row when inventory resolves to all zeros', async () => {
    mockResolvedKubernetes({ clusters: 0, pods: 0 });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.queryByText(/cluster/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('kubernetes-stats-skeleton')).not.toBeInTheDocument();
  });

  it('uses the standard short format for large pod counts', async () => {
    mockResolvedKubernetes({ clusters: 17, pods: 311101 });

    render(<RecommendationExisting />);

    expect(await screen.findByText('311 K pods')).toBeInTheDocument();
  });

  it('shows live logs stats without Kubernetes skeletons when switching away mid-fetch', async () => {
    mockActiveLogs();
    mockFetchInventory.mockImplementation(() => new Promise(() => {}));
    mockFetchCpuSeries.mockImplementation(() => new Promise(() => {}));

    const { user } = render(<RecommendationExisting />);

    expect(await screen.findByTestId('kubernetes-stats-skeleton')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Logs' }));

    expect(await screen.findByText('47 GB')).toBeInTheDocument();
    expect(screen.queryByTestId('kubernetes-stats-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kubernetes-sparkline-skeleton')).not.toBeInTheDocument();
  });

  it('ceils fractional counts so partial numbers never render', async () => {
    mockResolvedKubernetes({ clusters: 2.4, pods: 99.1 });

    render(<RecommendationExisting />);

    expect(await screen.findByText('3 clusters')).toBeInTheDocument();
    expect(screen.getByText('100 pods')).toBeInTheDocument();
  });

  it('renders the CPU sparkline caption when the series resolves', async () => {
    const frame = createDataFrame({
      refId: 'cpu',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'Value', type: FieldType.number, values: [0.1, 0.2, 0.3] },
      ],
    });
    mockFetchCpuSeries.mockResolvedValue(readSeries([frame], 'cpu'));

    render(<RecommendationExisting />);

    expect(await screen.findByText('Cluster CPU · last 24h')).toBeInTheDocument();
  });

  it('leads the alert strip with the firing-alert count when Prometheus reports one', async () => {
    mockFetchHealth.mockResolvedValue({
      alertsFiring: 3,
      unhealthyPods: 1,
      restarts1h: 0,
      notReadyNodes: 0,
    });

    render(<RecommendationExisting />);

    expect(await screen.findByText('3 alerts firing')).toBeInTheDocument();
  });

  it('shows the resolved datasource name under the title', async () => {
    render(<RecommendationExisting />);

    expect(await screen.findByText('via k8s-prom')).toBeInTheDocument();
  });

  it('names the winning datasource on telemetry solutions', async () => {
    mockActiveLogs();
    const { user } = render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Logs' }));

    expect(screen.getByText('via grafanacloud-logs')).toBeInTheDocument();
  });

  describe('analytics', () => {
    // LinkButton renders a plain <a href>; clicking it would trigger a real jsdom
    // navigation (console.error -> jest-fail-on-console). Route anchor clicks through
    // the SPA history the way the app does so the onClick fires without navigating.
    beforeEach(() => {
      document.addEventListener('click', interceptLinkClicks);
    });

    afterEach(() => {
      document.removeEventListener('click', interceptLinkClicks);
    });

    it('tracks open_solution when the main CTA is clicked', async () => {
      const { user } = render(<RecommendationExisting />);

      await user.click(await screen.findByRole('link', { name: /Open K8s app/ }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'existing_solution',
        action: 'open_solution',
        placement: 'card',
        solution: 'kubernetes',
      });
    });

    it('tracks view_alerts when the alert-strip link is clicked', async () => {
      mockFetchHealth.mockResolvedValue({
        alertsFiring: 3,
        unhealthyPods: 0,
        restarts1h: 0,
        notReadyNodes: 0,
      });

      const { user } = render(<RecommendationExisting />);

      await user.click(await screen.findByRole('link', { name: 'View' }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'existing_solution',
        action: 'view_alerts',
        placement: 'card',
        solution: 'kubernetes',
      });
    });

    it('tracks telemetry solutions with their own id', async () => {
      mockActiveLogs();
      const { user } = render(<RecommendationExisting />);

      expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Switch solution/i }));
      await user.click(screen.getByRole('menuitem', { name: 'Hosted Logs' }));
      await user.click(await screen.findByRole('link', { name: /Open in Explore/ }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'existing_solution',
        action: 'open_solution',
        placement: 'card',
        solution: 'logs',
      });
    });

    it('tracks switch_solution with the picked solution id', async () => {
      mockActiveLogs();
      const { user } = render(<RecommendationExisting />);

      expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Switch solution/i }));
      await user.click(screen.getByRole('menuitem', { name: 'Hosted Logs' }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'existing_solution',
        action: 'switch_solution',
        placement: 'card',
        solution: 'logs',
      });
    });

    it('does not track re-picking the already selected solution', async () => {
      const { user } = render(<RecommendationExisting />);

      expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Switch solution/i }));
      await user.click(screen.getByRole('menuitem', { name: 'Kubernetes Monitoring' }));

      expect(jest.mocked(ctaClicked)).not.toHaveBeenCalled();
    });
  });
});
