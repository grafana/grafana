import { createDataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { runDatasourceQueries } from './promQuery';
import { probeFound, tempoHasTraces } from './solutionDataProbes';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

jest.mock('./promQuery', () => ({
  ...jest.requireActual('./promQuery'),
  runDatasourceQueries: jest.fn(),
}));

const mockList = jest.mocked(getDataSourceInstanceList);
const mockQueries = jest.mocked(runDatasourceQueries);

function datasource(type: string, name = `${type}-ds`): DataSourceInstanceListItem {
  return {
    uid: name,
    name,
    type,
    meta: { id: type } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: false,
  };
}

beforeEach(() => {
  mockList.mockReset();
  mockQueries.mockReset();
});

describe('probeFound', () => {
  it('returns the first candidate that confirms data', async () => {
    mockList.mockResolvedValue([datasource('tempo', 'first'), datasource('tempo', 'second')]);

    const found = await probeFound('tempo', async (ds) => ds.name === 'second');

    expect(found?.name).toBe('second');
  });

  it('settles null when every candidate probes clean-and-empty', async () => {
    mockList.mockResolvedValue([datasource('tempo')]);

    await expect(probeFound('tempo', async () => false)).resolves.toBeNull();
  });

  it('settles null for an empty candidate list', async () => {
    mockList.mockResolvedValue([]);

    const hasData = jest.fn();
    await expect(probeFound('tempo', hasData)).resolves.toBeNull();
    expect(hasData).not.toHaveBeenCalled();
  });

  it('throws when a candidate errored and no data was found elsewhere', async () => {
    mockList.mockResolvedValue([datasource('tempo', 'broken'), datasource('tempo', 'empty')]);

    await expect(
      probeFound('tempo', async (ds) => {
        if (ds.name === 'broken') {
          throw new Error('probe failed');
        }
        return false;
      })
    ).rejects.toThrow(/1 tempo datasource probe\(s\) failed/);
  });

  it('never probes excluded uids', async () => {
    mockList.mockResolvedValue([datasource('loki', 'excluded'), datasource('loki', 'kept')]);

    const hasData = jest.fn().mockResolvedValue(true);
    const found = await probeFound('loki', hasData, new Set(['excluded']));

    expect(found?.name).toBe('kept');
    expect(hasData).toHaveBeenCalledTimes(1);
    expect(hasData).toHaveBeenCalledWith(expect.objectContaining({ uid: 'kept' }));
  });
});

describe('tempoHasTraces', () => {
  it('reports data when a Tempo search returns a trace', async () => {
    mockQueries.mockResolvedValue([
      createDataFrame({ refId: 'traces', fields: [{ name: 'traceID', type: FieldType.string, values: ['abc'] }] }),
    ]);

    await expect(tempoHasTraces(datasource('tempo'))).resolves.toBe(true);

    expect(mockQueries).toHaveBeenCalledWith(
      [{ refId: 'traces', queryType: 'traceql', query: '{}', limit: 1 }],
      expect.objectContaining({ raw: { from: 'now-24h', to: 'now' } }),
      expect.objectContaining({ type: 'tempo' }),
      expect.any(Number)
    );
  });

  it('reports no data when the Tempo search is empty', async () => {
    mockQueries.mockResolvedValue([]);

    await expect(tempoHasTraces(datasource('tempo'))).resolves.toBe(false);
  });
});
