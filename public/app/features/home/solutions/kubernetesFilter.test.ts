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
  it('asks the datasource once per label and cluster and shares the answer', async () => {
    getTagValues.mockResolvedValue([{ text: 'team-a', value: 'team-a' }]);

    await expect(fetchKubernetesLabelValues('uid-a', 'namespace', 'prod')).resolves.toEqual(['team-a']);
    await expect(fetchKubernetesLabelValues('uid-a', 'namespace', 'prod')).resolves.toEqual(['team-a']);

    expect(mockGetDataSourceInstance).toHaveBeenCalledWith({ uid: 'uid-a' });
    expect(getTagValues).toHaveBeenCalledTimes(1);
    expect(getTagValues).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'namespace',
        filters: [{ key: 'cluster', operator: '=', value: 'prod' }],
        queries: [{ refId: 'values', expr: 'kube_namespace_status_phase' }],
      })
    );
  });

  it('retries after an empty answer (how the language provider reports a failed lookup) or a rejection', async () => {
    getTagValues
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ text: 'team-a' }])
      .mockRejectedValueOnce(new Error('unreachable'))
      .mockResolvedValueOnce([{ text: 'node-1' }]);

    await expect(fetchKubernetesLabelValues('uid-b', 'namespace', '')).resolves.toEqual([]);
    await expect(fetchKubernetesLabelValues('uid-b', 'namespace', '')).resolves.toEqual(['team-a']);
    await expect(fetchKubernetesLabelValues('uid-b', 'node', '')).rejects.toThrow('unreachable');
    await expect(fetchKubernetesLabelValues('uid-b', 'node', '')).resolves.toEqual(['node-1']);

    expect(getTagValues).toHaveBeenCalledTimes(4);
    expect(getTagValues).toHaveBeenLastCalledWith(expect.objectContaining({ filters: [] }));
  });

  it('reads as empty when the datasource cannot list label values', async () => {
    mockGetDataSourceInstance.mockResolvedValue({} as DataSourceApi);

    await expect(fetchKubernetesLabelValues('uid-c', 'cluster', '')).resolves.toEqual([]);
  });
});
