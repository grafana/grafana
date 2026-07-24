import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { listProbeCandidates, MAX_PROBED_DATASOURCES, withTimeout } from './probeUtils';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const getDataSourceInstanceListMock = jest.mocked(getDataSourceInstanceList);

function listItem(ds: { uid?: string; name: string; isDefault?: boolean }): DataSourceInstanceListItem {
  return {
    uid: ds.uid ?? ds.name,
    name: ds.name,
    type: 'loki',
    meta: { id: 'loki' } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: ds.isDefault ?? false,
  };
}

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

describe('listProbeCandidates', () => {
  beforeEach(() => {
    getDataSourceInstanceListMock.mockReset();
  });

  it('drops excluded uids', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      listItem({ uid: 'excluded', name: 'utility' }),
      listItem({ uid: 'kept', name: 'product' }),
    ]);

    const candidates = await listProbeCandidates('loki', undefined, new Set(['excluded']));

    expect(candidates.map((ds) => ds.uid)).toEqual(['kept']);
  });

  it('never re-admits excluded uids through the utility-name fallback', async () => {
    // Every datasource is a cloud utility by name: the name fallback re-admits them, but an
    // excluded uid must stay out even then.
    getDataSourceInstanceListMock.mockResolvedValue([
      listItem({ uid: 'usage', name: 'grafanacloud-usage' }),
      listItem({ uid: 'ml', name: 'grafanacloud-ml-metrics' }),
    ]);

    const candidates = await listProbeCandidates('prometheus', undefined, new Set(['usage']));

    expect(candidates.map((ds) => ds.uid)).toEqual(['ml']);
  });

  it('returns empty when exclusions empty the list', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([listItem({ uid: 'only', name: 'grafanacloud-usage' })]);

    await expect(listProbeCandidates('prometheus', undefined, new Set(['only']))).resolves.toEqual([]);
  });

  it('skips cloud utility datasources unless they are all there is', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      listItem({ name: 'grafanacloud-usage' }),
      listItem({ name: 'product' }),
    ]);

    await expect(listProbeCandidates('prometheus')).resolves.toEqual([listItem({ name: 'product' })]);

    getDataSourceInstanceListMock.mockResolvedValue([listItem({ name: 'grafanacloud-usage' })]);

    await expect(listProbeCandidates('prometheus')).resolves.toEqual([listItem({ name: 'grafanacloud-usage' })]);
  });

  it('puts the default datasource first and applies the cap', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      ...Array.from({ length: MAX_PROBED_DATASOURCES }, (_, i) => listItem({ name: `ds-${i}` })),
      listItem({ name: 'the-default', isDefault: true }),
    ]);

    const candidates = await listProbeCandidates('loki');

    expect(candidates).toHaveLength(MAX_PROBED_DATASOURCES);
    expect(candidates[0].name).toBe('the-default');
  });
});
