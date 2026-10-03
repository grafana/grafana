import { type DataSourceInstanceListItem, type DataSourcePluginMeta } from '@grafana/data';

import { toInstanceSettings, toListSnapshot } from './mappers';
import { type DataSourceConnection, type DataSourceResource } from './types';

function meta(overrides: Partial<DataSourcePluginMeta>): DataSourcePluginMeta {
  return {
    id: 'prometheus',
    name: 'Prometheus',
    type: 'datasource',
    metrics: true,
    ...overrides,
  } as DataSourcePluginMeta;
}

function connection(overrides: Partial<DataSourceConnection>): DataSourceConnection {
  return {
    title: 'Prom',
    name: 'uid-prom',
    group: 'prometheus.datasource.grafana.app',
    version: 'v0alpha1',
    plugin: 'prometheus',
    ...overrides,
  };
}

function resource(spec: Partial<DataSourceResource['spec']>, labels?: Record<string, string>): DataSourceResource {
  return { metadata: { name: 'uid-prom', labels }, spec: { title: 'Prom', ...spec } };
}

const prometheus = meta({ id: 'prometheus', name: 'Prometheus' });
const postgres = meta({ id: 'grafana-postgresql-datasource', name: 'PostgreSQL', aliasIDs: ['postgres'] });
const grafanaBuiltIn = meta({ id: 'grafana', name: '-- Grafana --', builtIn: true });
const mixedBuiltIn = meta({ id: 'mixed', name: '-- Mixed --', builtIn: true });

describe('toListSnapshot', () => {
  it('maps a connection to a list item with the plugin meta and the served version', () => {
    const { snapshot } = toListSnapshot([connection({})], [prometheus]);

    expect(snapshot.items).toEqual([
      { uid: 'uid-prom', name: 'Prom', type: 'prometheus', apiVersion: 'v0alpha1', meta: prometheus, isDefault: false },
    ]);
  });

  it('takes the default from the default label', () => {
    const { snapshot } = toListSnapshot(
      [connection({ name: 'a' }), connection({ name: 'b', labels: { default: 'true' } })],
      [prometheus, grafanaBuiltIn]
    );

    expect(snapshot.defaultUid).toBe('b');
    expect(snapshot.items.find((item) => item.uid === 'b')?.isDefault).toBe(true);
  });

  it('falls back to -- Grafana -- as the default when no connection has the label, as boot data does', () => {
    const { snapshot } = toListSnapshot([connection({})], [prometheus, grafanaBuiltIn]);

    expect(snapshot.defaultUid).toBe('grafana');
  });

  it('normalizes an aliased plugin type to the plugin id', () => {
    const { snapshot } = toListSnapshot(
      [connection({ name: 'uid-pg', plugin: 'postgres', group: 'postgres.datasource.grafana.app' })],
      [postgres]
    );

    expect(snapshot.items[0].type).toBe('grafana-postgresql-datasource');
    expect(snapshot.items[0].meta).toBe(postgres);
  });

  it('derives the plugin type from the group when the connection omits it', () => {
    const { snapshot } = toListSnapshot([connection({ plugin: undefined })], [prometheus]);

    expect(snapshot.items[0].type).toBe('prometheus');
  });

  it('drops connections whose plugin has no meta and reports their types', () => {
    const { snapshot, droppedTypes } = toListSnapshot(
      [connection({}), connection({ name: 'uid-x', plugin: 'not-installed' })],
      [prometheus]
    );

    expect(snapshot.items.map((item) => item.uid)).toEqual(['uid-prom']);
    expect(droppedTypes).toEqual(['not-installed']);
  });

  it('synthesizes built-ins from the metas flagged builtIn, with the same uid and id as boot data', () => {
    const { snapshot } = toListSnapshot([], [prometheus, grafanaBuiltIn, mixedBuiltIn]);

    expect(snapshot.items).toEqual([
      { uid: 'grafana', name: '-- Grafana --', type: 'datasource', meta: grafanaBuiltIn, isDefault: false },
      { uid: '-- Mixed --', name: '-- Mixed --', type: 'datasource', meta: mixedBuiltIn, isDefault: false },
    ]);
    expect(snapshot.uidById).toEqual({ '-1': 'grafana' });
    expect(snapshot.settings?.grafana).toEqual({
      id: -1,
      uid: 'grafana',
      name: '-- Grafana --',
      type: 'datasource',
      meta: grafanaBuiltIn,
      jsonData: {},
      readOnly: false,
      isDefault: false,
    });
  });
});

describe('toInstanceSettings', () => {
  const item: DataSourceInstanceListItem = {
    uid: 'uid-prom',
    name: 'Prom',
    type: 'prometheus',
    apiVersion: 'v0alpha1',
    meta: prometheus,
    isDefault: true,
  };

  it('maps a proxy data source with the proxy URL and the id from the deprecated internal id label', () => {
    const { settings, isDirectAccess } = toInstanceSettings(
      resource(
        { access: 'proxy', url: 'http://prom:9090', readOnly: true, jsonData: { httpMethod: 'POST' } },
        { 'grafana.app/deprecatedInternalID': '12' }
      ),
      item,
      connection({})
    );

    expect(isDirectAccess).toBe(false);
    expect(settings).toEqual({
      id: 12,
      uid: 'uid-prom',
      name: 'Prom',
      type: 'prometheus',
      apiVersion: 'v0alpha1',
      meta: prometheus,
      isDefault: true,
      access: 'proxy',
      readOnly: true,
      url: '/api/datasources/proxy/uid/uid-prom',
      jsonData: { httpMethod: 'POST', directUrl: 'http://prom:9090' },
    });
  });

  it('leaves out the basic auth fields for a proxy data source, as boot data does', () => {
    const { settings } = toInstanceSettings(
      resource({ access: 'proxy', basicAuth: true, basicAuthUser: 'admin', user: 'u', withCredentials: true }),
      item,
      connection({})
    );

    expect(settings).not.toHaveProperty('basicAuth');
    expect(settings).not.toHaveProperty('username');
    expect(settings).not.toHaveProperty('withCredentials');
    expect(settings.url).toBe('/api/datasources/proxy/uid/uid-prom');
  });

  it('keeps the upstream URL and withCredentials, but no credentials, for a direct data source', () => {
    const { settings, isDirectAccess } = toInstanceSettings(
      resource({
        access: 'direct',
        url: 'http://prom:9090',
        basicAuth: true,
        basicAuthUser: 'admin',
        withCredentials: true,
      }),
      item,
      connection({})
    );

    expect(isDirectAccess).toBe(true);
    expect(settings.url).toBe('http://prom:9090');
    expect(settings.withCredentials).toBe(true);
    expect(settings).not.toHaveProperty('basicAuth');
    expect(settings).not.toHaveProperty('password');
  });

  it('defaults access to proxy and readOnly to false when the spec omits them', () => {
    const { settings } = toInstanceSettings(resource({}), item, connection({}));

    expect(settings.access).toBe('proxy');
    expect(settings.readOnly).toBe(false);
  });

  it('does not mutate the resource jsonData', () => {
    const jsonData = { httpMethod: 'POST' };

    toInstanceSettings(resource({ url: 'http://prom:9090', jsonData }), item, connection({}));

    expect(jsonData).toEqual({ httpMethod: 'POST' });
  });

  it.each([
    { plugin: 'mssql', jsonData: {}, expected: { database: 'db' } },
    { plugin: 'mysql', jsonData: { database: '' }, expected: { database: 'db' } },
    { plugin: 'grafana-postgresql-datasource', jsonData: { database: 'kept' }, expected: { database: 'kept' } },
  ])('backfills jsonData.database from the spec for $plugin when it is empty', ({ plugin, jsonData, expected }) => {
    const { settings } = toInstanceSettings(
      resource({ database: 'db', jsonData }),
      { ...item, type: plugin },
      connection({ plugin })
    );

    expect(settings.jsonData).toEqual(expected);
  });

  it.each(['influxdb', 'elasticsearch'])('sets the top-level database for %s', (plugin) => {
    const { settings } = toInstanceSettings(
      resource({ database: 'logs' }),
      { ...item, type: plugin },
      connection({ plugin })
    );

    expect(settings.database).toBe('logs');
  });

  it.each(['prometheus', 'grafana-amazonprometheus-datasource', 'grafana-azureprometheus-datasource'])(
    'sets jsonData.directUrl to the upstream URL for %s',
    (plugin) => {
      const { settings } = toInstanceSettings(
        resource({ url: 'http://prom:9090' }),
        { ...item, type: plugin },
        connection({ plugin })
      );

      expect(settings.jsonData).toEqual({ directUrl: 'http://prom:9090' });
    }
  );

  it('matches the per-type tweaks on the stored type, before alias normalization', () => {
    // Boot data matches on ds.Type, so an aliased `postgres` gets no database backfill.
    const { settings } = toInstanceSettings(
      resource({ database: 'db' }),
      { ...item, type: 'grafana-postgresql-datasource' },
      connection({ plugin: 'postgres' })
    );

    expect(settings.jsonData).toEqual({});
  });
});
