import type { DataQuery, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { resolveCards } from './resolveCards';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

function makeSettings(uid: string, name: string, pluginId: string): DataSourceInstanceSettings {
  return { uid, name, type: pluginId, meta: { id: pluginId } } as unknown as DataSourceInstanceSettings;
}

const PROM = makeSettings('p1', 'Prometheus', 'prometheus');
const PROM_TWO = makeSettings('p2', 'Prometheus two', 'prometheus');
const AMAZON_PROM = makeSettings('a1', 'Amazon Prometheus', 'grafana-amazonprometheus-datasource');
const LOKI = makeSettings('l1', 'Loki', 'loki');

/** Resolves the given settings by uid, and anything else to `undefined` (a deleted datasource). */
function mockDatasources(...all: DataSourceInstanceSettings[]) {
  const byUid = new Map(all.map((settings) => [settings.uid, settings]));
  jest.mocked(getDataSourceSrv).mockReturnValue({
    getInstanceSettings: (ref: string | { uid?: string } | null | undefined) =>
      byUid.get(typeof ref === 'string' ? ref : (ref?.uid ?? '')),
  } as unknown as ReturnType<typeof getDataSourceSrv>);
}

const mixedInstance = { meta: { mixed: true }, getRef: () => ({ uid: '-- Mixed --', type: 'datasource' }) };

function instanceOf(settings: DataSourceInstanceSettings): DataSourceApi {
  return {
    meta: settings.meta,
    getRef: () => ({ uid: settings.uid, type: settings.type }),
  } as unknown as DataSourceApi;
}

describe('resolveCards', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns one card per query, resolved to its own datasource', () => {
    mockDatasources(PROM, LOKI);

    const cards = resolveCards(
      [
        { refId: 'A', datasource: { uid: 'p1' } },
        { refId: 'B', datasource: { uid: 'l1' } },
      ],
      undefined
    );

    expect(cards).toEqual([
      expect.objectContaining({ refId: 'A', dsRef: { uid: 'p1', type: 'prometheus' }, isPrometheus: true }),
      expect.objectContaining({ refId: 'B', dsRef: { uid: 'l1', type: 'loki' }, isPrometheus: false }),
    ]);
  });

  it('never lets the Mixed ref reach a card', () => {
    mockDatasources(PROM, PROM_TWO);

    const cards = resolveCards(
      [
        { refId: 'A', datasource: { uid: 'p1' } },
        { refId: 'B', datasource: { uid: 'p2' } },
      ],
      mixedInstance as unknown as DataSourceApi
    );

    expect(cards.map((card) => card.dsRef.uid)).toEqual(['p1', 'p2']);
  });

  it('leaves a datasource-less query in a mixed pane without a datasource rather than the Mixed one', () => {
    mockDatasources(PROM);

    const cards = resolveCards([{ refId: 'A' }], mixedInstance as unknown as DataSourceApi);

    expect(cards[0].dsRef).toEqual({});
    expect(cards[0].dsName).toBeUndefined();
    expect(cards[0].isPrometheus).toBe(false);
  });

  it('inherits the pane datasource for a datasource-less query in a non-mixed pane', () => {
    mockDatasources(PROM);

    const cards = resolveCards([{ refId: 'A' }], instanceOf(PROM));

    expect(cards[0].dsRef).toEqual({ uid: 'p1', type: 'prometheus' });
    expect(cards[0].dsName).toBe('Prometheus');
    expect(cards[0].isPrometheus).toBe(true);
  });

  it('recognises a managed Prometheus flavour', () => {
    mockDatasources(AMAZON_PROM);

    const cards = resolveCards([{ refId: 'A', datasource: { uid: 'a1' } }], undefined);

    expect(cards[0].isPrometheus).toBe(true);
  });

  it('keeps the raw ref and no name for a datasource that no longer resolves', () => {
    mockDatasources(PROM);

    const cards = resolveCards([{ refId: 'A', datasource: { uid: 'deleted' } }], undefined);

    expect(cards[0].dsRef).toEqual({ uid: 'deleted' });
    expect(cards[0].dsName).toBeUndefined();
    expect(cards[0].isPrometheus).toBe(false);
  });

  it('returns no cards when the pane has no queries', () => {
    mockDatasources(PROM);

    expect(resolveCards(undefined, instanceOf(PROM))).toEqual([]);
    expect(resolveCards([] as DataQuery[], instanceOf(PROM))).toEqual([]);
  });
});
