import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
} from '@grafana/data';

import { compareListWithBootData, compareSettingsWithBootData, listForLog } from './parity';

const meta = { id: 'prometheus', name: 'Prometheus', type: 'datasource' } as DataSourcePluginMeta;

function item(overrides: Partial<DataSourceInstanceListItem>): DataSourceInstanceListItem {
  return { uid: 'uid-a', name: 'A', type: 'prometheus', meta, isDefault: false, ...overrides };
}

function settings(overrides: Partial<DataSourceInstanceSettings>): DataSourceInstanceSettings {
  return {
    id: 1,
    uid: 'uid-a',
    name: 'A',
    type: 'prometheus',
    meta,
    access: 'proxy',
    url: '/api/datasources/proxy/uid/uid-a',
    readOnly: false,
    isDefault: false,
    jsonData: { manageAlerts: true },
    ...overrides,
  };
}

describe('compareListWithBootData', () => {
  it('reports no difference when both sides have the same data sources and default', () => {
    const parity = compareListWithBootData(
      { items: [item({ isDefault: true })], defaultUid: 'uid-a' },
      { datasources: { A: settings({ isDefault: true }) }, defaultDatasource: 'A' }
    );

    expect(parity).toEqual({
      bootItems: 1,
      missingInMt: [],
      extraInMt: [],
      fieldMismatches: [],
      defaultMismatch: false,
    });
  });

  it('lists the uids that only one side has', () => {
    const parity = compareListWithBootData(
      { items: [item({ uid: 'uid-mt-only' })] },
      { datasources: { A: settings({}) }, defaultDatasource: '' }
    );

    expect(parity.missingInMt).toEqual(['uid-a']);
    expect(parity.extraInMt).toEqual(['uid-mt-only']);
  });

  it('lists each differing list field as uid:field', () => {
    const parity = compareListWithBootData(
      { items: [item({ name: 'Renamed', type: 'loki', isDefault: true })] },
      { datasources: { A: settings({}) }, defaultDatasource: '' }
    );

    expect(parity.fieldMismatches).toEqual(['uid-a:name', 'uid-a:type', 'uid-a:isDefault']);
  });

  it('reports a default mismatch when the default uids differ', () => {
    const parity = compareListWithBootData(
      { items: [item({}), item({ uid: 'uid-b', name: 'B' })], defaultUid: 'uid-b' },
      { datasources: { A: settings({}), B: settings({ uid: 'uid-b', name: 'B' }) }, defaultDatasource: 'A' }
    );

    expect(parity.defaultMismatch).toBe(true);
  });

  it('matches a boot-data built-in without a uid by its name', () => {
    const mixed = settings({ uid: '', name: '-- Mixed --', type: 'datasource' });

    const parity = compareListWithBootData(
      { items: [item({ uid: '-- Mixed --', name: '-- Mixed --', type: 'datasource' })] },
      { datasources: { '-- Mixed --': mixed }, defaultDatasource: '' }
    );

    expect(parity.missingInMt).toEqual([]);
    expect(parity.extraInMt).toEqual([]);
  });
});

describe('listForLog', () => {
  it('joins at most 20 entries with commas', () => {
    const values = Array.from({ length: 25 }, (_, i) => `uid-${i}`);

    expect(listForLog(values).split(',')).toHaveLength(20);
    expect(listForLog(['a', 'b'])).toBe('a,b');
  });
});

describe('compareSettingsWithBootData', () => {
  it('reports no field when the compared fields match', () => {
    expect(compareSettingsWithBootData(settings({}), settings({}))).toEqual([]);
  });

  it('names each differing field and never its value', () => {
    const fields = compareSettingsWithBootData(
      settings({ id: 2, url: 'http://upstream', access: 'direct', readOnly: true, database: 'db' }),
      settings({})
    );

    expect(fields).toEqual(['id', 'access', 'url', 'readOnly', 'database']);
  });

  it('compares the jsonData keys, not the values', () => {
    expect(compareSettingsWithBootData(settings({ jsonData: { manageAlerts: false } }), settings({}))).toEqual([]);
    expect(compareSettingsWithBootData(settings({ jsonData: {} }), settings({}))).toEqual(['jsonData']);
  });

  it('ignores the fields the MT APIs leave out on purpose', () => {
    const boot = settings({ basicAuth: 'Basic secret', cachingConfig: { enabled: true, TTLMs: 1000 } });

    expect(compareSettingsWithBootData(settings({}), boot)).toEqual([]);
  });
});
