import { type DataSourceApi } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import { fetchKubernetesLabelValues, parseKubernetesFilter } from './kubernetesFilter';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

const mockGetDataSourceInstance = jest.mocked(getDataSourceInstance);
const getTagValues = jest.fn();

const stored = {
  datasourceUid: 'uid-a',
  datasourceName: 'Prometheus',
  cluster: 'prod',
  namespaces: ['team-a'],
  nodes: ['node-1'],
};

beforeEach(() => {
  getTagValues.mockReset();
  mockGetDataSourceInstance.mockReset();
  mockGetDataSourceInstance.mockResolvedValue({ getTagValues } as unknown as DataSourceApi);
});

describe('parseKubernetesFilter', () => {
  it('reads a missing, malformed or wrongly shaped value as fleet-wide', () => {
    expect(parseKubernetesFilter(undefined)).toBeNull();
    expect(parseKubernetesFilter('{not json')).toBeNull();
    expect(parseKubernetesFilter(JSON.stringify({ ...stored, namespaces: 'team-a' }))).toBeNull();
  });

  it('trims values, drops blank entries and reads what is left empty as fleet-wide', () => {
    expect(
      parseKubernetesFilter(JSON.stringify({ ...stored, cluster: ' prod ', namespaces: ['', ' a '], nodes: [] }))
    ).toEqual({ ...stored, cluster: 'prod', namespaces: ['a'], nodes: [] });
    expect(parseKubernetesFilter(JSON.stringify({ ...stored, cluster: ' ', namespaces: [''], nodes: [] }))).toBeNull();
  });
});

describe('fetchKubernetesLabelValues', () => {
  it('asks the datasource for the label values of the source metric within the cluster', async () => {
    getTagValues.mockResolvedValue([{ text: 'team-a', value: 'team-a' }]);

    await expect(fetchKubernetesLabelValues('uid-a', 'namespace', 'prod')).resolves.toEqual(['team-a']);

    expect(mockGetDataSourceInstance).toHaveBeenCalledWith({ uid: 'uid-a' });
    expect(getTagValues).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'namespace',
        filters: [{ key: 'cluster', operator: '=', value: 'prod' }],
        queries: [{ refId: 'values', expr: 'kube_namespace_status_phase' }],
      })
    );

    // No local cache: the datasource owns reuse, so every call reaches it.
    await fetchKubernetesLabelValues('uid-a', 'namespace', '');

    expect(getTagValues).toHaveBeenCalledTimes(2);
    expect(getTagValues).toHaveBeenLastCalledWith(expect.objectContaining({ filters: [] }));
  });

  it('reads as empty when the datasource cannot list label values', async () => {
    mockGetDataSourceInstance.mockResolvedValue({} as DataSourceApi);

    await expect(fetchKubernetesLabelValues('uid-c', 'cluster', '')).resolves.toEqual([]);
  });
});
