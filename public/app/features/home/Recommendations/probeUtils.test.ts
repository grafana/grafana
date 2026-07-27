import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { listProbeCandidates, withTimeout } from './probeUtils';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockGetDataSourceInstanceList = jest.mocked(getDataSourceInstanceList);

function datasource(uid: string, name: string, isDefault = false): DataSourceInstanceListItem {
  return {
    uid,
    name,
    isDefault,
    type: 'prometheus',
    meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
    readOnly: false,
  };
}

beforeEach(() => mockGetDataSourceInstanceList.mockReset());

describe('listProbeCandidates', () => {
  async function candidateUids(
    datasources: DataSourceInstanceListItem[],
    options?: Parameters<typeof listProbeCandidates>[1]
  ): Promise<string[]> {
    mockGetDataSourceInstanceList.mockResolvedValue(datasources);
    const candidates = await listProbeCandidates('prometheus', options);
    return candidates.map((ds) => ds.uid);
  }

  it('puts the default before other product datasources and excludes utilities', async () => {
    const result = await candidateUids([
      datasource('other', 'other-prom'),
      datasource('grafanacloud-usage', 'grafanacloud-usage'),
      datasource('default', 'default-prom', true),
      datasource('grafanacloud-ml-metrics', 'grafanacloud-ml-metrics'),
    ]);

    expect(result).toEqual(['default', 'other']);
  });

  it('preserves list order when no product datasource is default', async () => {
    const result = await candidateUids([
      datasource('second', 'second-prom'),
      datasource('first', 'first-prom'),
      datasource('grafanacloud-usage', 'grafanacloud-usage'),
    ]);

    expect(result).toEqual(['second', 'first']);
  });

  it('falls back to utilities in list order when no product datasource exists', async () => {
    const result = await candidateUids([
      datasource('grafanacloud-ml-metrics', 'grafanacloud-ml-metrics'),
      datasource('grafanacloud-usage', 'grafanacloud-usage'),
    ]);

    expect(result).toEqual(['grafanacloud-ml-metrics', 'grafanacloud-usage']);
  });

  it('puts a default utility first when no product datasource exists', async () => {
    const result = await candidateUids([
      datasource('grafanacloud-ml-metrics', 'grafanacloud-ml-metrics'),
      datasource('grafanacloud-usage', 'grafanacloud-usage', true),
    ]);

    expect(result).toEqual(['grafanacloud-usage', 'grafanacloud-ml-metrics']);
  });

  it('promotes preferred UIDs in supplied order and applies the cap afterward', async () => {
    const result = await candidateUids(
      [
        datasource('default', 'default-prom', true),
        datasource('grafanacloud-usage', 'grafanacloud-usage'),
        datasource('preferred', 'preferred-prom'),
        datasource('other', 'other-prom'),
        datasource('grafanacloud-ml-metrics', 'grafanacloud-ml-metrics'),
      ],
      {
        cap: 4,
        preferredUids: ['preferred', 'grafanacloud-ml-metrics', 'grafanacloud-usage', 'missing'],
      }
    );

    expect(result).toEqual(['preferred', 'grafanacloud-ml-metrics', 'grafanacloud-usage', 'default']);
  });

  it('does not fall back to utilities when the only product datasource is preferred', async () => {
    const result = await candidateUids(
      [
        datasource('grafanacloud-usage', 'grafanacloud-usage'),
        datasource('preferred', 'preferred-prom'),
        datasource('grafanacloud-ml-metrics', 'grafanacloud-ml-metrics'),
      ],
      { preferredUids: ['preferred'] }
    );

    expect(result).toEqual(['preferred']);
  });

  it('puts a preferred utility before remaining utility fallbacks', async () => {
    const result = await candidateUids(
      [
        datasource('grafanacloud-ml-metrics', 'grafanacloud-ml-metrics'),
        datasource('grafanacloud-usage', 'grafanacloud-usage'),
      ],
      { preferredUids: ['grafanacloud-usage'] }
    );

    expect(result).toEqual(['grafanacloud-usage', 'grafanacloud-ml-metrics']);
  });

  it('returns an empty list when no datasource is available', async () => {
    const result = await candidateUids([]);

    expect(result).toEqual([]);
  });
});

describe('withTimeout', () => {
  it('resolves with the promise value when it settles inside the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('propagates a rejection that happens inside the deadline', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
  });

  it('rejects once the deadline passes while the promise hangs', async () => {
    const hang = new Promise<never>(() => {});

    await expect(withTimeout(hang, 20)).rejects.toThrow(/timed out/i);
  });
});
