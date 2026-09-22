import { act, render, screen, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { mockComboboxRect } from '@grafana/test-utils';

import { RecommendationExisting } from '../Recommendations/RecommendationExisting';
import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  type KubernetesScope,
  resolveKubernetesDatasource,
} from '../solutions/kubernetesData';
import { fetchKubernetesLabelValues, kubernetesFilterStorageKey } from '../solutions/kubernetesFilter';
import { logsSolution } from '../solutions/logsSolution';
import { metricsSolution } from '../solutions/metricsSolution';
import { pluginAvailability, setupGuideEnabled } from '../solutions/pluginAvailability';
import { accessibleAppPage } from '../solutions/pluginPages';
import { syntheticsSolution } from '../solutions/syntheticsSolution';
import { deferred, stubSolution } from '../solutions/test-utils';
import { tracesSolution } from '../solutions/tracesSolution';
import { useHomepageSolutions } from '../useHomepageSolutions';

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

// The other solutions stay inert so the Kubernetes one is the only live card in both sections.
jest.mock('../solutions/logsSolution', () => ({ logsSolution: jest.fn() }));
jest.mock('../solutions/metricsSolution', () => ({ metricsSolution: jest.fn() }));
jest.mock('../solutions/tracesSolution', () => ({ tracesSolution: jest.fn() }));
jest.mock('../solutions/syntheticsSolution', () => ({ syntheticsSolution: jest.fn() }));

jest.mock('./useGuides', () => ({ useGuides: jest.fn() }));

mockComboboxRect();

const mockFetchInventory = jest.mocked(fetchKubernetesInventory);
const datasource = { uid: 'k8s-uid', name: 'k8s-prom', type: 'prometheus' } as DataSourceInstanceListItem;

beforeEach(() => {
  jest.mocked(logsSolution).mockImplementation(() => stubSolution('logs'));
  jest.mocked(metricsSolution).mockImplementation(() => stubSolution('metrics'));
  jest.mocked(tracesSolution).mockImplementation(() => stubSolution('traces'));
  jest.mocked(syntheticsSolution).mockImplementation(() => stubSolution('synthetics'));
  window.localStorage.clear();
  jest.mocked(useGuides).mockReturnValue([]);
  jest.mocked(resolveKubernetesDatasource).mockReset();
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

/** Both homepage sections read the one solution set the real owner builds. */
function Homepage() {
  const { solutions } = useHomepageSolutions();
  return (
    <>
      <RecommendationExisting solutions={solutions} />
      <Overview solutions={solutions} />
    </>
  );
}

it('reloads both homepage cards with scoped facts after saving a filter', async () => {
  // Scoped inventory settles on demand so the reload window is observable.
  const scopedInventory = deferred<{ clusters: number; pods: number }>();
  mockFetchInventory.mockImplementation(async (_ds, scope: KubernetesScope | null) =>
    scope === null ? { clusters: 2, pods: 24 } : scopedInventory.promise
  );
  const { user } = render(<Homepage />);

  expect(await screen.findAllByText('2 clusters')).toHaveLength(2);

  await user.click(screen.getByRole('button', { name: 'Filter by cluster, namespace, or node' }));
  const dialog = await screen.findByRole('dialog', { name: 'Filter Kubernetes Monitoring' });
  const cluster = within(dialog).getByRole('combobox', { name: 'Cluster' });
  await waitFor(() => expect(cluster).toBeEnabled());
  await user.click(cluster);
  await user.click(await screen.findByRole('option', { name: 'prod' }));
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));

  // Neither card keeps the fleet-wide figures while the scoped ones load.
  await waitFor(() => expect(screen.queryByText('2 clusters')).not.toBeInTheDocument());
  expect(screen.queryByText('1 cluster')).not.toBeInTheDocument();
  expect(screen.getAllByTestId('solution-stats-skeleton').length).toBeGreaterThan(0);

  await act(async () => scopedInventory.resolve({ clusters: 1, pods: 3 }));

  // Both cards return with the scoped counts; the Overview gear is highlighted.
  await waitFor(() => expect(screen.getAllByText('1 cluster')).toHaveLength(2));
  expect(screen.queryByTestId('solution-stats-skeleton')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit filters (Cluster: prod)' })).toBeInTheDocument();
  // Each solution's facts are shared by both cards, and recreating the solution kept its detection.
  expect(mockFetchInventory.mock.calls).toEqual([
    [datasource, null],
    [datasource, expect.objectContaining({ cluster: 'prod' })],
  ]);
  expect(jest.mocked(resolveKubernetesDatasource)).toHaveBeenCalledTimes(1);
  // Bound to the datasource the card resolved.
  expect(JSON.parse(window.localStorage.getItem(kubernetesFilterStorageKey()) ?? '')).toMatchObject({
    datasourceUid: 'k8s-uid',
  });
});
