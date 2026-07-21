import { render, screen } from 'test/test-utils';

import { createDataFrame, type DataSourceInstanceListItem, FieldType, type PluginMeta } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { AccessControlAction } from 'app/types/accessControl';

import { RecommendationsView } from './RecommendationsView';
import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
  type KubernetesHealth,
  type KubernetesInventory,
} from './kubernetesData';
import { fetchLogsStats, fetchLogsVolume, resolveLogsDatasource } from './logsData';
import { readSeries } from './promQuery';
import { fetchSpanRateSeries, fetchTopErrorService, fetchTracesServices, resolveTracesDatasource } from './tracesData';
import { type RecommendationItem } from './types';

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

jest.mock('./logsData', () => ({
  ...jest.requireActual('./logsData'),
  resolveLogsDatasource: jest.fn(),
  fetchLogsStats: jest.fn(),
  fetchLogsVolume: jest.fn(),
}));

jest.mock('./tracesData', () => ({
  ...jest.requireActual('./tracesData'),
  resolveTracesDatasource: jest.fn(),
  fetchTracesServices: jest.fn(),
  fetchSpanRateSeries: jest.fn(),
  fetchTopErrorService: jest.fn(),
}));

const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockResolveK8s = jest.mocked(resolveKubernetesDatasource);
const mockFetchInventory = jest.mocked(fetchKubernetesInventory);
const mockFetchHealth = jest.mocked(fetchKubernetesHealth);
const mockFetchCpuSeries = jest.mocked(fetchClusterCpuSeries);
const mockResolveLogs = jest.mocked(resolveLogsDatasource);
const mockFetchLogsStats = jest.mocked(fetchLogsStats);
const mockFetchLogsVolume = jest.mocked(fetchLogsVolume);
const mockResolveTraces = jest.mocked(resolveTracesDatasource);
const mockFetchTracesServices = jest.mocked(fetchTracesServices);
const mockFetchSpanRate = jest.mocked(fetchSpanRateSeries);
const mockFetchTopErrorService = jest.mocked(fetchTopErrorService);

const settings = { id: 'grafana-k8s-app' } as PluginMeta<{}>;

function listItem(uid: string, name: string, type: string): DataSourceInstanceListItem {
  return {
    uid,
    name,
    type,
    meta: { id: type } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: false,
  };
}

const promDs = listItem('k8s-uid', 'k8s-prom', 'prometheus');
const lokiDs = listItem('loki-uid', 'team-loki', 'loki');
const tempoDs = listItem('tempo-uid', 'team-tempo', 'tempo');

const healthyInventory: KubernetesInventory = { clusters: 3, pods: 247 };
const healthyHealth: KubernetesHealth = { alertsFiring: null, unhealthyPods: 0, restarts1h: 0, notReadyNodes: 0 };

const recommendations: RecommendationItem[] = [
  {
    id: 'demo-app',
    title: 'Demo App',
    icon: 'apps',
    color: '#ff8833',
    context: 'Because you are testing',
    description: 'A demo recommendation card.',
    action: 'Enable Demo App',
    href: '/plugins/demo-app',
  },
];

function sparklineFixture(refId: string) {
  const frame = createDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
      { name: 'Value', type: FieldType.number, values: [10, 20, 30] },
    ],
  });
  return readSeries([frame], refId);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockUsePluginBridge.mockReturnValue({ loading: false, installed: true, settings });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  mockResolveK8s.mockResolvedValue(promDs);
  mockFetchInventory.mockResolvedValue(healthyInventory);
  mockFetchHealth.mockResolvedValue(healthyHealth);
  mockFetchCpuSeries.mockResolvedValue(null);
  mockResolveLogs.mockResolvedValue({ ds: lokiDs, sourceLabel: 'service_name' });
  mockFetchLogsStats.mockResolvedValue({ bytes7d: 47_000_000_000, sources7d: 8 });
  mockFetchLogsVolume.mockResolvedValue({ series: null, spike: null });
  mockResolveTraces.mockResolvedValue({ ds: tempoDs, serviceCount: 384 });
  mockFetchTracesServices.mockResolvedValue(384);
  mockFetchSpanRate.mockResolvedValue({ series: null, errorRate: null });
  mockFetchTopErrorService.mockResolvedValue(null);
});

afterEach(() => jest.restoreAllMocks());

function renderView() {
  return render(<RecommendationsView recommendations={recommendations} />);
}

describe('existing solutions', () => {
  it('lists live Kubernetes, Logs and Traces entries in the switch-solution dropdown', async () => {
    const { user } = renderView();

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));

    expect(screen.getByRole('menuitem', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Hosted Logs' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Hosted Traces' })).toBeInTheDocument();
  });

  it('shows the Hosted Logs entry with formatted bytes, sources and an Explore CTA', async () => {
    mockFetchLogsVolume.mockResolvedValue({ series: sparklineFixture('vol'), spike: null });
    const { user } = renderView();

    await user.click(await screen.findByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Logs' }));

    expect(screen.getByRole('heading', { name: 'Hosted Logs' })).toBeInTheDocument();
    expect(screen.getByText('via team-loki')).toBeInTheDocument();
    expect(await screen.findByText('47 GB')).toBeInTheDocument();
    expect(screen.getByText('ingested · 7d · 8 sources')).toBeInTheDocument();
    expect(screen.getByText('Ingest volume · last 24h')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: 'Open Explore (Logs)' });
    expect(cta).toHaveAttribute('href', expect.stringContaining('/explore'));
    expect(cta.getAttribute('href')).toContain('loki-uid');
  });

  it('renders the logs spike alert row with a View link into Explore', async () => {
    mockFetchLogsVolume.mockResolvedValue({
      series: sparklineFixture('vol'),
      spike: { source: 'checkout-service', ratio: 3 },
    });
    const { user } = renderView();

    await user.click(await screen.findByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Logs' }));

    expect(await screen.findByText('Ingest spike detected')).toBeInTheDocument();
    expect(screen.getByText('checkout-service logs up 3× in the last hour')).toBeInTheDocument();
    const view = screen.getByRole('link', { name: 'View' });
    expect(view).toHaveAttribute('href', expect.stringContaining('/explore'));
    expect(decodeURIComponent(view.getAttribute('href') ?? '')).toContain('checkout-service');
  });

  it('hides the logs stats row when nothing was ingested', async () => {
    mockFetchLogsStats.mockResolvedValue({ bytes7d: 0, sources7d: 0 });
    const { user } = renderView();

    await user.click(await screen.findByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Logs' }));

    expect(screen.getByRole('heading', { name: 'Hosted Logs' })).toBeInTheDocument();
    expect(screen.queryByText(/ingested/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Explore (Logs)' })).toBeInTheDocument();
  });

  it('shows the Hosted Traces entry with service count, span-rate sparkline and an Explore CTA', async () => {
    mockFetchSpanRate.mockResolvedValue({ series: sparklineFixture('spans'), errorRate: null });
    const { user } = renderView();

    await user.click(await screen.findByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Traces' }));

    expect(screen.getByRole('heading', { name: 'Hosted Traces' })).toBeInTheDocument();
    expect(screen.getByText('via team-tempo')).toBeInTheDocument();
    expect(await screen.findByText('384')).toBeInTheDocument();
    expect(screen.getByText('services sending traces')).toBeInTheDocument();
    expect(screen.getByText('Span rate · last 3h')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: 'Open Explore (Traces)' });
    expect(cta).toHaveAttribute('href', expect.stringContaining('/explore'));
    expect(cta.getAttribute('href')).toContain('tempo-uid');
  });

  it('renders the traces error alert only above the error-rate floor', async () => {
    mockFetchSpanRate.mockResolvedValue({ series: null, errorRate: 404 });
    mockFetchTopErrorService.mockResolvedValue({ service: 'checkout', rate: 250 });
    const { user } = renderView();

    await user.click(await screen.findByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Traces' }));

    expect(await screen.findByText('≈404 error spans/s')).toBeInTheDocument();
    expect(screen.getByText('checkout leads at 250/s in the last hour')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', expect.stringContaining('/explore'));
  });

  it('suppresses the traces alert below the error-rate floor', async () => {
    mockFetchSpanRate.mockResolvedValue({ series: null, errorRate: 0.2 });
    const { user } = renderView();

    await user.click(await screen.findByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Traces' }));

    expect(await screen.findByText('384')).toBeInTheDocument();
    expect(screen.queryByText(/error spans/)).not.toBeInTheDocument();
  });

  it('omits the Logs and Traces entries without the datasources:explore permission', async () => {
    jest
      .mocked(contextSrv.hasPermission)
      .mockImplementation((action) => action !== AccessControlAction.DataSourcesExplore);
    const { user } = renderView();

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));

    expect(screen.getByRole('menuitem', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Hosted Logs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Hosted Traces' })).not.toBeInTheDocument();
  });

  it('shows Logs and Traces without Kubernetes when the k8s app is unavailable, querying nothing from it', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    const { user } = renderView();

    expect(await screen.findByRole('heading', { name: 'Hosted Logs' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));

    expect(screen.queryByRole('menuitem', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Hosted Logs' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Hosted Traces' })).toBeInTheDocument();
    expect(mockResolveK8s).not.toHaveBeenCalled();
    expect(mockFetchInventory).not.toHaveBeenCalled();
  });

  it('drops the left card and arrow when every resolution settles empty, keeping the carousel', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    mockResolveLogs.mockResolvedValue(null);
    mockFetchLogsStats.mockRejectedValue(new Error('No Loki datasource with log data'));
    mockFetchLogsVolume.mockRejectedValue(new Error('No Loki datasource with log data'));
    mockResolveTraces.mockResolvedValue(null);
    mockFetchTracesServices.mockRejectedValue(new Error('No Tempo datasource with trace data'));
    mockFetchSpanRate.mockRejectedValue(new Error('No Tempo datasource with trace data'));

    renderView();

    expect(await screen.findByRole('region', { name: 'Recommended apps' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Enable Demo App/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Switch solution/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('existing-solution-arrow')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument();
  });

  it('shows a full-card skeleton while the plugin settings are pending', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: true, installed: undefined, settings: undefined });
    mockResolveLogs.mockImplementation(() => new Promise(() => {}));
    mockResolveTraces.mockImplementation(() => new Promise(() => {}));

    renderView();

    expect(await screen.findByTestId('recommendation-existing-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
  });

  it('keeps the skeleton up while any resolution is still pending', async () => {
    mockResolveTraces.mockImplementation(() => new Promise(() => {}));

    renderView();

    expect(await screen.findByTestId('recommendation-existing-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
  });

  it('keeps the Kubernetes entry first and selected by default', async () => {
    renderView();

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    expect(screen.getByText('via k8s-prom')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open K8s app' })).toBeInTheDocument();
  });

  it('shows the Kubernetes card without Logs or Traces when their resolutions settle empty', async () => {
    mockResolveLogs.mockResolvedValue(null);
    mockResolveTraces.mockResolvedValue(null);
    const { user } = renderView();

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));

    expect(screen.queryByRole('menuitem', { name: 'Hosted Logs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Hosted Traces' })).not.toBeInTheDocument();
  });
});
