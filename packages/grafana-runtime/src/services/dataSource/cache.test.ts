import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import {
  _resetForTests,
  applySnapshot,
  awaitFill,
  getListItemByUid,
  loadSettingsCached,
  setDataSourceCacheSource,
  toListItem,
  upsertRuntimeSettings,
} from './cache';
import { getDataSourceCacheGeneration } from './cacheGeneration';
import { type DataSourceCacheSource, type DataSourceListSnapshot } from './sources/types';

function ds(uid: string, name: string): DataSourceInstanceSettings {
  return {
    uid,
    name,
    type: 'test-db',
    access: 'proxy',
    jsonData: {},
    readOnly: false,
    meta: { id: 'test-db', name: 'Test DB', type: 'datasource', metrics: true } as DataSourcePluginMeta,
  };
}

function snapshotOf(...settings: DataSourceInstanceSettings[]): DataSourceListSnapshot {
  return { items: settings.map(toListItem) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// A source that has to fetch its list, as the MT source will.
function fetchingSource(overrides: Partial<DataSourceCacheSource> = {}): DataSourceCacheSource {
  return {
    kind: 'mt',
    getInitialSnapshot: () => undefined,
    loadList: jest.fn().mockResolvedValue({ items: [] }),
    refreshList: jest.fn(),
    refreshMetas: jest.fn(),
    loadSettings: jest.fn(),
    ...overrides,
  };
}

const alpha = ds('uid-alpha', 'Alpha');
const bravo = ds('uid-bravo', 'Bravo');

beforeEach(() => {
  _resetForTests();
});

describe('fill', () => {
  it('applies the initial snapshot synchronously when the source has one', () => {
    setDataSourceCacheSource(fetchingSource({ getInitialSnapshot: () => snapshotOf(alpha) }));

    expect(getListItemByUid('uid-alpha')?.name).toBe('Alpha');
  });

  it('makes concurrent callers share one list load and resolves them once it is applied', async () => {
    const list = deferred<DataSourceListSnapshot>();
    const loadList = jest.fn().mockReturnValue(list.promise);
    setDataSourceCacheSource(fetchingSource({ loadList }));

    const waiting = Promise.all([awaitFill(), awaitFill()]);
    expect(getListItemByUid('uid-alpha')).toBeUndefined();
    list.resolve(snapshotOf(alpha));
    await waiting;

    expect(loadList).toHaveBeenCalledTimes(1);
    expect(getListItemByUid('uid-alpha')?.name).toBe('Alpha');
  });

  it('rejects waiting callers when the list load fails, and starts a new load on the next call', async () => {
    const loadList = jest
      .fn()
      .mockRejectedValueOnce(new Error('connections failed'))
      .mockResolvedValueOnce(snapshotOf(bravo));
    setDataSourceCacheSource(fetchingSource({ loadList }));

    await expect(awaitFill()).rejects.toThrow('connections failed');
    await awaitFill();

    expect(loadList).toHaveBeenCalledTimes(2);
    expect(getListItemByUid('uid-bravo')?.name).toBe('Bravo');
  });

  it('does not bump the cache generation when the list load fails', async () => {
    setDataSourceCacheSource(fetchingSource({ loadList: jest.fn().mockRejectedValue(new Error('down')) }));
    const generation = getDataSourceCacheGeneration();

    await expect(awaitFill()).rejects.toThrow('down');

    expect(getDataSourceCacheGeneration()).toBe(generation);
  });

  it('drops a list load that resolves after a newer snapshot was applied', async () => {
    const list = deferred<DataSourceListSnapshot>();
    setDataSourceCacheSource(fetchingSource({ loadList: () => list.promise }));

    applySnapshot(snapshotOf(bravo));
    list.resolve(snapshotOf(alpha));
    await list.promise;

    expect(getListItemByUid('uid-bravo')?.name).toBe('Bravo');
    expect(getListItemByUid('uid-alpha')).toBeUndefined();
  });

  it('resolves waiting callers when the list load fails after a newer snapshot was applied', async () => {
    const list = deferred<DataSourceListSnapshot>();
    setDataSourceCacheSource(fetchingSource({ loadList: () => list.promise }));
    const waiting = awaitFill();

    applySnapshot(snapshotOf(bravo));
    list.reject(new Error('connections failed'));

    await expect(waiting).resolves.toBeUndefined();
    expect(getListItemByUid('uid-bravo')?.name).toBe('Bravo');
  });

  it('re-applies runtime data sources to every snapshot', () => {
    upsertRuntimeSettings(ds('runtime-ds', 'Runtime'));

    applySnapshot(snapshotOf(alpha));

    expect(getListItemByUid('runtime-ds')?.name).toBe('Runtime');
  });
});

describe('loadSettingsCached', () => {
  it('returns preloaded settings without asking the source', async () => {
    const loadSettings = jest.fn();
    setDataSourceCacheSource(fetchingSource({ loadSettings }));
    applySnapshot({ ...snapshotOf(alpha), settings: { 'uid-alpha': alpha } });

    expect(await loadSettingsCached('uid-alpha')).toBe(alpha);
    expect(loadSettings).not.toHaveBeenCalled();
  });

  it('makes concurrent callers for one uid share a single load, then serves it from the cache', async () => {
    const loadSettings = jest.fn().mockResolvedValue(alpha);
    setDataSourceCacheSource(fetchingSource({ loadSettings }));
    applySnapshot(snapshotOf(alpha));

    const [first, second] = await Promise.all([loadSettingsCached('uid-alpha'), loadSettingsCached('uid-alpha')]);
    const third = await loadSettingsCached('uid-alpha');

    expect([first, second, third]).toEqual([alpha, alpha, alpha]);
    expect(loadSettings).toHaveBeenCalledTimes(1);
    expect(loadSettings).toHaveBeenCalledWith('uid-alpha');
  });

  it('does not cache a miss, so the next call asks the source again', async () => {
    const loadSettings = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(alpha);
    setDataSourceCacheSource(fetchingSource({ loadSettings }));
    applySnapshot(snapshotOf(alpha));

    expect(await loadSettingsCached('uid-alpha')).toBeUndefined();
    expect(await loadSettingsCached('uid-alpha')).toBe(alpha);
    expect(loadSettings).toHaveBeenCalledTimes(2);
  });

  it('does not cache settings whose load was in flight when a new snapshot replaced the layer', async () => {
    const stale = deferred<DataSourceInstanceSettings>();
    const loadSettings = jest.fn().mockReturnValueOnce(stale.promise).mockResolvedValueOnce(bravo);
    setDataSourceCacheSource(fetchingSource({ loadSettings }));
    applySnapshot(snapshotOf(alpha));

    const inflight = loadSettingsCached('uid-alpha');
    applySnapshot(snapshotOf(alpha));
    stale.resolve(alpha);
    await inflight;

    expect(await loadSettingsCached('uid-alpha')).toBe(bravo);
    expect(loadSettings).toHaveBeenCalledTimes(2);
  });
});
