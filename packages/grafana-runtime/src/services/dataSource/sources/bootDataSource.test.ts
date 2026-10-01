import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import { type BackendSrv, setBackendSrv } from '../../backendSrv';

import { createBootDataSnapshot, createBootDataSource } from './bootDataSource';

function ds(overrides: Partial<DataSourceInstanceSettings>): DataSourceInstanceSettings {
  return {
    uid: 'uid',
    name: 'name',
    type: 'test-db',
    access: 'proxy',
    jsonData: {},
    readOnly: false,
    meta: { id: 'test-db', name: 'Test DB', type: 'datasource', metrics: true } as DataSourcePluginMeta,
    ...overrides,
  };
}

describe('createBootDataSnapshot', () => {
  it('builds a list item and preloads settings for every data source', () => {
    const alpha = ds({ id: 1, uid: 'uid-alpha', name: 'Alpha', isDefault: true, apiVersion: 'v1' });

    const snapshot = createBootDataSnapshot({ datasources: { Alpha: alpha }, defaultDatasource: 'Alpha' });

    expect(snapshot.items).toEqual([
      { uid: 'uid-alpha', name: 'Alpha', type: 'test-db', apiVersion: 'v1', meta: alpha.meta, isDefault: true },
    ]);
    expect(snapshot.settings).toEqual({ 'uid-alpha': alpha });
    expect(snapshot.settings?.['uid-alpha']).toBe(alpha);
  });

  it('uses the name as uid for entries without one, as built-ins arrive in boot data', () => {
    const mixed = ds({ uid: '', name: '-- Mixed --', type: 'datasource' });

    const snapshot = createBootDataSnapshot({ datasources: { '-- Mixed --': mixed }, defaultDatasource: '' });

    expect(snapshot.items[0].uid).toBe('-- Mixed --');
    expect(Object.keys(snapshot.settings ?? {})).toEqual(['-- Mixed --']);
  });

  it('maps numeric ids to uids and skips entries without an id', () => {
    const snapshot = createBootDataSnapshot({
      datasources: {
        Alpha: ds({ id: 7, uid: 'uid-alpha', name: 'Alpha' }),
        Bravo: ds({ id: 0, uid: 'uid-bravo', name: 'Bravo' }),
        Grafana: ds({ id: -1, uid: 'grafana', name: '-- Grafana --' }),
      },
      defaultDatasource: '',
    });

    expect(snapshot.uidById).toEqual({ '7': 'uid-alpha', '-1': 'grafana' });
  });

  it.each([
    { desc: 'a name', defaultDatasource: 'Bravo', expected: 'uid-bravo' },
    { desc: 'a uid', defaultDatasource: 'uid-alpha', expected: 'uid-alpha' },
    { desc: 'an unknown value', defaultDatasource: 'Nope', expected: undefined },
  ])('resolves the default from $desc', ({ defaultDatasource, expected }) => {
    const snapshot = createBootDataSnapshot({
      datasources: {
        Alpha: ds({ uid: 'uid-alpha', name: 'Alpha' }),
        Bravo: ds({ uid: 'uid-bravo', name: 'Bravo' }),
      },
      defaultDatasource,
    });

    expect(snapshot.defaultUid).toBe(expected);
  });

  it('prefers a uid match over a name match for the default', () => {
    const snapshot = createBootDataSnapshot({
      datasources: {
        // A data source whose uid equals another one's name.
        Alpha: ds({ uid: 'Bravo', name: 'Alpha' }),
        Bravo: ds({ uid: 'uid-bravo', name: 'Bravo' }),
      },
      defaultDatasource: 'Bravo',
    });

    expect(snapshot.defaultUid).toBe('Bravo');
  });
});

describe('createBootDataSource', () => {
  const get = jest.fn();

  beforeEach(() => {
    get.mockReset();
    setBackendSrv({ get } as unknown as BackendSrv);
  });

  it('builds the refreshed snapshot from a passed payload without fetching', async () => {
    const source = createBootDataSource({ datasources: {}, defaultDatasource: '' });
    const alpha = ds({ uid: 'uid-alpha', name: 'Alpha' });

    const snapshot = await source.refreshList({ datasources: { Alpha: alpha }, defaultDatasource: 'Alpha' });

    expect(get).not.toHaveBeenCalled();
    expect(snapshot.defaultUid).toBe('uid-alpha');
  });

  it('fetches /api/frontend/settings when refreshed without a payload', async () => {
    const source = createBootDataSource({ datasources: {}, defaultDatasource: '' });
    get.mockResolvedValue({ datasources: { Bravo: ds({ uid: 'uid-bravo', name: 'Bravo' }) }, defaultDatasource: '' });

    const snapshot = await source.refreshList();

    expect(get).toHaveBeenCalledWith('/api/frontend/settings');
    expect(snapshot.items.map((item) => item.uid)).toEqual(['uid-bravo']);
  });
});
