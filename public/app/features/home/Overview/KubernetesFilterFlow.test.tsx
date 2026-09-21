import { render, screen, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { mockComboboxRect } from '@grafana/test-utils';

import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  type KubernetesScope,
  resolveKubernetesDatasource,
} from '../solutions/kubernetesData';
import { fetchKubernetesLabelValues, kubernetesFilterStorageKey } from '../solutions/kubernetesFilter';
import { kubernetesSolution } from '../solutions/kubernetesSolution';
import { pluginAvailability, setupGuideEnabled } from '../solutions/pluginAvailability';
import { accessibleAppPage } from '../solutions/pluginPages';

import { Overview } from './Overview';
import { useGuides } from './useGuides';

jest.mock('../solutions/kubernetesData', () => ({
  ...jest.requireActual('../solutions/kubernetesData'),
  fetchClusterCpuSeries: jest.fn(),
  fetchKubernetesHealth: jest.fn(),
  fetchKubernetesInventory: jest.fn(),
  resolveKubernetesDatasource: jest.fn(),
}));

jest.mock('../solutions/kubernetesFilter', () => ({
  ...jest.requireActual('../solutions/kubernetesFilter'),
  fetchKubernetesLabelValues: jest.fn(),
}));

jest.mock('../solutions/pluginAvailability', () => ({
  pluginAvailability: jest.fn(),
  setupGuideEnabled: jest.fn(),
}));

jest.mock('../solutions/pluginPages', () => ({
  ...jest.requireActual('../solutions/pluginPages'),
  accessibleAppPage: jest.fn(),
}));

jest.mock('./useGuides', () => ({ useGuides: jest.fn() }));

mockComboboxRect();

const mockFetchInventory = jest.mocked(fetchKubernetesInventory);
const datasource = { uid: 'k8s-uid', name: 'k8s-prom', type: 'prometheus' } as DataSourceInstanceListItem;

beforeEach(() => {
  window.localStorage.clear();
  jest.mocked(useGuides).mockReturnValue([]);
  jest.mocked(resolveKubernetesDatasource).mockResolvedValue(datasource);
  jest
    .mocked(fetchKubernetesHealth)
    .mockResolvedValue({ alertsFiring: null, unhealthyPods: 0, restarts1h: 0, notReadyNodes: 0 });
  jest.mocked(fetchClusterCpuSeries).mockResolvedValue(null);
  mockFetchInventory.mockReset();
  mockFetchInventory.mockImplementation(async (_ds, scope: KubernetesScope | null) =>
    scope === null ? { clusters: 2, pods: 24 } : { clusters: 1, pods: 3 }
  );
  jest.mocked(fetchKubernetesLabelValues).mockImplementation(async (_uid, key) => (key === 'cluster' ? ['prod'] : []));
  jest.mocked(pluginAvailability).mockResolvedValue(new Map([['grafana-k8s-app', { state: 'setup' }]]));
  jest.mocked(setupGuideEnabled).mockResolvedValue(false);
  jest.mocked(accessibleAppPage).mockImplementation(async (appId, path) => `/a/${appId}${path}`);
});

it('reloads the Kubernetes card with scoped facts after saving a filter', async () => {
  const { user } = render(<Overview solutions={[kubernetesSolution()]} />);

  expect(await screen.findByText('2 clusters')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Filter by cluster, namespace, or node' }));
  const dialog = await screen.findByRole('dialog', { name: 'Filter Kubernetes Monitoring' });
  const cluster = within(dialog).getByRole('combobox', { name: 'Cluster' });
  await waitFor(() => expect(cluster).toBeEnabled());
  await user.click(cluster);
  await user.click(await screen.findByRole('option', { name: 'prod' }));
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));

  // The card reloads in place and returns with the scoped counts and the highlighted gear.
  expect(await screen.findByText('1 cluster')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit filters (Cluster: prod)' })).toBeInTheDocument();
  expect(mockFetchInventory.mock.calls).toEqual([
    [datasource, null],
    [datasource, expect.objectContaining({ cluster: 'prod' })],
  ]);
  // Bound to the datasource the card resolved.
  expect(JSON.parse(window.localStorage.getItem(kubernetesFilterStorageKey()) ?? '')).toMatchObject({
    datasourceUid: 'k8s-uid',
  });
});
