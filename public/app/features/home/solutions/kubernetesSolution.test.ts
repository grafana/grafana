import { type DataSourceInstanceListItem, type FieldSparkline } from '@grafana/data';

import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  type KubernetesHealth,
  resolveKubernetesDatasource,
} from './kubernetesData';
import { kubernetesSolution } from './kubernetesSolution';
import { pluginAvailability, setupGuideEnabled } from './pluginAvailability';
import { accessibleAppPage } from './pluginPages';

jest.mock('./kubernetesData', () => ({
  ...jest.requireActual('./kubernetesData'),
  fetchClusterCpuSeries: jest.fn(),
  fetchKubernetesHealth: jest.fn(),
  fetchKubernetesInventory: jest.fn(),
  resolveKubernetesDatasource: jest.fn(),
}));

jest.mock('./pluginAvailability', () => ({
  pluginAvailability: jest.fn(),
  setupGuideEnabled: jest.fn(),
}));

jest.mock('./pluginPages', () => ({
  ...jest.requireActual('./pluginPages'),
  accessibleAppPage: jest.fn(),
}));

const mockFetchCpu = jest.mocked(fetchClusterCpuSeries);
const mockFetchHealth = jest.mocked(fetchKubernetesHealth);
const mockFetchInventory = jest.mocked(fetchKubernetesInventory);
const mockResolveDatasource = jest.mocked(resolveKubernetesDatasource);
const mockPluginAvailability = jest.mocked(pluginAvailability);
const mockSetupGuideEnabled = jest.mocked(setupGuideEnabled);
const mockAccessibleAppPage = jest.mocked(accessibleAppPage);

const datasource = { uid: 'k8s-uid', name: 'k8s-prom', type: 'prometheus' } as DataSourceInstanceListItem;
const healthy: KubernetesHealth = { alertsFiring: null, unhealthyPods: 0, restarts1h: 0, notReadyNodes: 0 };

beforeEach(() => {
  mockFetchCpu.mockReset();
  mockFetchCpu.mockResolvedValue(null);
  mockFetchHealth.mockReset();
  mockFetchHealth.mockResolvedValue(healthy);
  mockFetchInventory.mockReset();
  mockFetchInventory.mockResolvedValue({ clusters: 2, pods: 24 });
  mockResolveDatasource.mockReset();
  mockResolveDatasource.mockResolvedValue(datasource);
  mockPluginAvailability.mockReset();
  mockPluginAvailability.mockResolvedValue(new Map([['grafana-k8s-app', { state: 'setup' }]]));
  mockSetupGuideEnabled.mockReset();
  mockSetupGuideEnabled.mockResolvedValue(false);
  mockAccessibleAppPage.mockReset();
  mockAccessibleAppPage.mockImplementation(async (appId, path) => `/a/${appId}${path}`);
});

describe('kubernetesSolution', () => {
  it('constructs an inert solution with its identity available synchronously', () => {
    const solution = kubernetesSolution();

    expect(solution).toMatchObject({ id: 'kubernetes', icon: 'kubernetes', title: 'Kubernetes Monitoring' });
    expect(mockResolveDatasource).not.toHaveBeenCalled();
    expect(mockFetchHealth).not.toHaveBeenCalled();
    expect(mockFetchInventory).not.toHaveBeenCalled();
    expect(mockFetchCpu).not.toHaveBeenCalled();
    expect(mockPluginAvailability).not.toHaveBeenCalled();
  });

  it('shares one active detection between signal and datasource readers', async () => {
    const solution = kubernetesSolution();

    await expect(solution.signal()).resolves.toBe('active');
    await expect(solution.datasource()).resolves.toBe(datasource);
    await expect(solution.signal()).resolves.toBe('active');
    expect(mockResolveDatasource).toHaveBeenCalledTimes(1);
  });

  it('reads the datasource from a supplied detector instead of detecting on its own', async () => {
    const detect = jest.fn(async () => ({ status: 'active' as const, datasource }));
    const solution = kubernetesSolution(null, detect);

    await expect(solution.signal()).resolves.toBe('active');
    await solution.stats();

    expect(mockResolveDatasource).not.toHaveBeenCalled();
    expect(mockFetchInventory).toHaveBeenCalledWith(datasource, {});
    expect(detect).toHaveBeenCalled();
  });

  it('reports inactive with no datasource after a definitive empty result', async () => {
    mockResolveDatasource.mockResolvedValue(null);
    const solution = kubernetesSolution();

    await expect(solution.signal()).resolves.toBe('inactive');
    await expect(solution.datasource()).resolves.toBeNull();
  });

  it('degrades a failed detection to unknown without starting detail queries', async () => {
    mockResolveDatasource.mockRejectedValue(new Error('datasource list failed'));
    const solution = kubernetesSolution();

    await expect(solution.signal()).resolves.toBe('unknown');
    await expect(solution.datasource()).resolves.toBeNull();
    await expect(solution.needsAttention()).resolves.toBe(false);
    await expect(solution.stats()).resolves.toBeNull();
    await expect(solution.alert()).resolves.toBeNull();
    await expect(solution.sparkline()).resolves.toBeNull();
    await expect(solution.cta()).resolves.toBeNull();
    expect(mockResolveDatasource).toHaveBeenCalledTimes(1);
    expect(mockFetchInventory).not.toHaveBeenCalled();
    expect(mockFetchHealth).not.toHaveBeenCalled();
    expect(mockFetchCpu).not.toHaveBeenCalled();
  });

  it('queries each detail once with the datasource that proved Kubernetes usage', async () => {
    const series = { x: { values: [1] }, y: { values: [2] } } as unknown as FieldSparkline;
    mockFetchCpu.mockResolvedValue(series);
    const solution = kubernetesSolution();

    await Promise.all([
      solution.stats(),
      solution.stats(),
      solution.needsAttention(),
      solution.needsAttention(),
      solution.alert(),
      solution.alert(),
      solution.sparkline(),
    ]);

    expect(mockResolveDatasource).toHaveBeenCalledTimes(1);
    expect(mockFetchInventory).toHaveBeenCalledTimes(1);
    expect(mockFetchInventory).toHaveBeenCalledWith(datasource, expect.anything());
    expect(mockFetchHealth).toHaveBeenCalledTimes(1);
    expect(mockFetchHealth).toHaveBeenCalledWith(datasource, expect.anything());
    expect(mockFetchCpu).toHaveBeenCalledTimes(1);
    expect(mockFetchCpu).toHaveBeenCalledWith(datasource, expect.anything());
  });
});

describe('kubernetesSolution alert', () => {
  it('returns no alert for a healthy cluster without probing the app', async () => {
    const solution = kubernetesSolution();

    await expect(solution.needsAttention()).resolves.toBe(false);
    await expect(solution.alert()).resolves.toBeNull();
    expect(mockAccessibleAppPage).not.toHaveBeenCalled();
  });

  it('leads with firing alerts', async () => {
    mockFetchHealth.mockResolvedValue({ alertsFiring: 3, unhealthyPods: 1, restarts1h: 0, notReadyNodes: 0 });

    const solution = kubernetesSolution();
    await expect(solution.needsAttention()).resolves.toBe(true);
    expect(mockAccessibleAppPage).not.toHaveBeenCalled();
    await expect(solution.alert()).resolves.toEqual({
      primary: '3 alerts firing',
      details: ['1 pod pending or failed'],
    });
    expect(mockAccessibleAppPage).not.toHaveBeenCalled();
    expect(mockFetchHealth).toHaveBeenCalledTimes(1);
  });

  it('leads with the first health row when nothing is firing', async () => {
    mockFetchHealth.mockResolvedValue({ alertsFiring: null, unhealthyPods: 2, restarts1h: 5, notReadyNodes: 1 });

    await expect(kubernetesSolution().alert()).resolves.toMatchObject({
      primary: '2 pods pending or failed',
      details: ['5 restarts in the last hour', '1 node not ready'],
    });
  });
});

describe('kubernetesSolution stats and sparkline', () => {
  it('formats cluster and pod inventory', async () => {
    await expect(kubernetesSolution().stats()).resolves.toEqual({
      primary: '2 clusters',
      secondary: '24 pods',
    });
  });

  it('shows zero inventory for an empty scope', async () => {
    mockFetchInventory.mockResolvedValue({ clusters: 0, pods: 0 });

    await expect(kubernetesSolution().stats()).resolves.toEqual({
      primary: '0 clusters',
      secondary: '0 pods',
    });
  });

  it('scopes every fact to a selection saved for the resolved datasource', async () => {
    const values = { cluster: 'prod', namespaces: ['team-a'] };
    const solution = kubernetesSolution({ datasourceUid: 'k8s-uid', values });

    await solution.stats();
    await solution.needsAttention();
    await solution.sparkline();

    expect(mockFetchInventory).toHaveBeenCalledWith(datasource, values);
    expect(mockFetchHealth).toHaveBeenCalledWith(datasource, values);
    expect(mockFetchCpu).toHaveBeenCalledWith(datasource, values);
  });

  it('runs unscoped when the selection was saved for another datasource', async () => {
    const solution = kubernetesSolution({ datasourceUid: 'other-uid', values: { cluster: 'prod', nodes: ['node-1'] } });

    await solution.stats();
    await solution.needsAttention();
    await solution.sparkline();

    expect(mockFetchInventory).toHaveBeenCalledWith(datasource, {});
    expect(mockFetchHealth).toHaveBeenCalledWith(datasource, {});
    expect(mockFetchCpu).toHaveBeenCalledWith(datasource, {});
  });

  it.each([
    { desc: 'no selection', selection: null, caption: 'Cluster CPU · last 24h' },
    {
      desc: 'a namespace filter',
      selection: { datasourceUid: 'k8s-uid', values: { namespaces: ['team-a'] } },
      caption: 'Namespace CPU · last 24h',
    },
    // Nodes are the narrower scope, so they win the caption when both filters are set.
    {
      desc: 'namespace and node filters',
      selection: { datasourceUid: 'k8s-uid', values: { namespaces: ['team-a'], nodes: ['node-1'] } },
      caption: 'Node CPU · last 24h',
    },
  ])('captions the CPU trend for $desc', async ({ selection, caption }) => {
    const series = { x: { values: [1] }, y: { values: [2] } } as unknown as FieldSparkline;
    mockFetchCpu.mockResolvedValue(series);

    await expect(kubernetesSolution(selection).sparkline()).resolves.toEqual({ series, caption });
  });

  it('omits the sparkline when the CPU metric is unavailable', async () => {
    await expect(kubernetesSolution().sparkline()).resolves.toBeNull();
  });
});

describe('kubernetesSolution CTA and offer', () => {
  it('opens the alerts page when the solution needs attention', async () => {
    mockFetchHealth.mockResolvedValue({ alertsFiring: 3, unhealthyPods: 1, restarts1h: 0, notReadyNodes: 0 });

    await expect(kubernetesSolution().cta()).resolves.toEqual({
      label: 'View alerts in Kubernetes Monitoring',
      href: '/a/grafana-k8s-app/alerts?var-datasource=k8s-prom',
      action: 'view_alerts',
    });
    expect(mockAccessibleAppPage).toHaveBeenCalledWith('grafana-k8s-app', '/alerts');
  });

  it('falls back to the solution page when the alerts page is inaccessible', async () => {
    mockFetchHealth.mockResolvedValue({ alertsFiring: 1, unhealthyPods: 0, restarts1h: 0, notReadyNodes: 0 });
    mockAccessibleAppPage.mockImplementation(async (appId, path) => (path === '/alerts' ? null : `/a/${appId}${path}`));

    await expect(kubernetesSolution().cta()).resolves.toEqual({
      label: 'Open Kubernetes Monitoring',
      href: '/a/grafana-k8s-app/home?var-datasource=k8s-prom',
      action: 'open_solution',
    });
  });

  it('opens the app with the proving datasource when accessible', async () => {
    await expect(kubernetesSolution().cta()).resolves.toEqual({
      label: 'Open Kubernetes Monitoring',
      href: '/a/grafana-k8s-app/home?var-datasource=k8s-prom',
      action: 'open_solution',
    });
    expect(mockAccessibleAppPage).toHaveBeenCalledWith('grafana-k8s-app', '/home');
  });

  it('falls back to Explore using the proving datasource when the app is inaccessible', async () => {
    mockAccessibleAppPage.mockResolvedValue(null);

    const cta = await kubernetesSolution().cta();

    expect(cta?.label).toBe('Open in Explore');
    expect(cta?.href).toMatch(/^\/explore\?left=/);
    expect(cta?.action).toBe('open_solution');
    expect(decodeURIComponent(cta!.href)).toContain('k8s-prom');
  });

  it('offers the accessible setup flow after a definitive no-data result', async () => {
    mockResolveDatasource.mockResolvedValue(null);

    await expect(kubernetesSolution().offer()).resolves.toEqual({
      availability: 'setup',
      description: 'See cluster health, cost, and right-sizing savings in one view.',
      setupHint: '~3 min · Helm/Alloy',
      cta: {
        label: 'Set up',
        href: '/a/grafana-k8s-app/configuration/cluster-config',
        action: 'setup',
      },
    });
    expect(mockAccessibleAppPage).toHaveBeenCalledWith('grafana-k8s-app', '/configuration/cluster-config');
  });

  it('keeps the offer without a CTA when the setup page is inaccessible', async () => {
    mockResolveDatasource.mockResolvedValue(null);
    mockAccessibleAppPage.mockResolvedValue(null);

    await expect(kubernetesSolution().offer()).resolves.toEqual({
      availability: 'setup',
      description: 'See cluster health, cost, and right-sizing savings in one view.',
      setupHint: '~3 min · Helm/Alloy',
      cta: null,
    });
  });

  it('never loads plugin availability for an active solution', async () => {
    await expect(kubernetesSolution().offer()).resolves.toBeNull();
    expect(mockPluginAvailability).not.toHaveBeenCalled();
    expect(mockSetupGuideEnabled).not.toHaveBeenCalled();
  });
});
