import { render, screen } from 'test/test-utils';

import { createDataFrame, FieldType, type DataSourceInstanceListItem, type PluginMeta } from '@grafana/data';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

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

const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockResolveDatasource = jest.mocked(resolveKubernetesDatasource);
const mockFetchInventory = jest.mocked(fetchKubernetesInventory);
const mockFetchHealth = jest.mocked(fetchKubernetesHealth);
const mockFetchCpuSeries = jest.mocked(fetchClusterCpuSeries);

const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

const settings = { id: 'grafana-k8s-app' } as PluginMeta<{}>;
const datasource: DataSourceInstanceListItem = {
  uid: 'k8s-uid',
  name: 'k8s-prom',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: false,
};

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
});

afterEach(() => jest.restoreAllMocks());

describe('RecommendationExisting', () => {
  it('opens the dropdown and switches the selected solution', async () => {
    const { user } = render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Metrics' }));

    expect(screen.getByRole('heading', { name: 'Hosted Metrics' })).toBeInTheDocument();
    expect(screen.getByText('4.2M series')).toBeInTheDocument();
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

  it('shows stubs immediately when settings are unavailable without awaiting resolution', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
    mockResolveDatasource.mockImplementation(() => new Promise(() => {}));

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Hosted Metrics' })).toBeInTheDocument();
    expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument();
    expect(mockResolveDatasource).not.toHaveBeenCalled();
  });

  it('shows stubs and never queries Kubernetes when the app is installed but disabled', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings });

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Hosted Metrics' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
    expect(mockResolveDatasource).not.toHaveBeenCalled();
    expect(mockFetchInventory).not.toHaveBeenCalled();
  });

  it('shows stubs when resolution returns null', async () => {
    mockResolveDatasource.mockResolvedValue(null);
    mockFetchInventory.mockRejectedValue(new Error('No Prometheus datasource with Kubernetes data'));
    mockFetchHealth.mockRejectedValue(new Error('No Prometheus datasource with Kubernetes data'));

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Hosted Metrics' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
  });

  it('shows stubs when resolution rejects without flashing the Kubernetes title', async () => {
    mockResolveDatasource.mockRejectedValue(new Error('probe failed'));

    render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Hosted Metrics' })).toBeInTheDocument();
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
    expect(screen.queryByRole('heading', { name: 'Hosted Metrics' })).not.toBeInTheDocument();
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

  it('compact-formats large pod counts', async () => {
    const pods = 311101;
    mockResolvedKubernetes({ clusters: 17, pods });

    render(<RecommendationExisting />);

    const expectedPods = compactFormatter.format(pods);
    expect(await screen.findByText(`${expectedPods} pods`)).toBeInTheDocument();
  });

  it('shows stub stats without skeletons when switching away while Kubernetes data is pending', async () => {
    mockFetchInventory.mockImplementation(() => new Promise(() => {}));
    mockFetchCpuSeries.mockImplementation(() => new Promise(() => {}));

    const { user } = render(<RecommendationExisting />);

    expect(await screen.findByTestId('kubernetes-stats-skeleton')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Metrics' }));

    expect(screen.getByText('4.2M series')).toBeInTheDocument();
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

  it('omits the datasource subtitle on stub solutions', async () => {
    const { user } = render(<RecommendationExisting />);

    expect(await screen.findByRole('heading', { name: 'Kubernetes Monitoring' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Metrics' }));

    expect(screen.queryByText(/^via /)).not.toBeInTheDocument();
  });
});
