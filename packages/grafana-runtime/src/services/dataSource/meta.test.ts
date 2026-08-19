import { type DataSourceInstanceSettings, type DataSourcePluginMeta, PluginType } from '@grafana/data';

import { setDatasourcePluginMetas } from '../pluginMeta/datasources';
import { type DatasourcePluginMetas } from '../pluginMeta/types';

import { getDataSourceInstanceMeta } from './meta';
import { setDataSourceInstanceSettings, upsertRuntimeDataSourceInstanceSettings } from './settings';

function pluginMeta(id: string, overrides: Partial<DataSourcePluginMeta> = {}): DataSourcePluginMeta {
  return {
    id,
    name: id,
    type: PluginType.datasource,
    module: '',
    baseUrl: '',
    info: {
      author: { name: '' },
      description: '',
      links: [],
      logos: { small: `${id}-plugin-logo.svg`, large: '' },
      screenshots: [],
      updated: '',
      version: '',
    },
    metrics: true,
    ...overrides,
  };
}

function ds(overrides: Partial<DataSourceInstanceSettings>): DataSourceInstanceSettings {
  return {
    id: 1,
    uid: 'uid',
    name: 'name',
    type: 'test-db',
    access: 'direct',
    jsonData: {},
    readOnly: false,
    // Deliberately distinguishable from the plugin meta of the same id: every assertion
    // that expects a `*-plugin-logo.svg` proves the pluginMeta cache was the source.
    meta: pluginMeta('test-db', {
      info: { ...pluginMeta('test-db').info, logos: { small: 'instance-logo.svg', large: '' } },
    }),
    ...overrides,
  } as DataSourceInstanceSettings;
}

const instances: Record<string, DataSourceInstanceSettings> = {
  Alpha: ds({ id: 1, uid: 'uid-alpha', name: 'Alpha', type: 'test-db' }),
  Bravo: ds({ id: 2, uid: 'uid-bravo', name: 'Bravo', type: 'default-db', isDefault: true }),
  Aliased: ds({ id: 3, uid: 'uid-aliased', name: 'Aliased', type: 'loki-alias' }),
  // Built-ins arrive from boot data with the plugin *type* as their instance type, not their
  // plugin id (see getFSDataSources in pkg/api/bootdata.go) — the case that makes the
  // name-based mapping in getDataSourceInstanceMeta necessary.
  '-- Grafana --': ds({ id: 4, uid: '-- Grafana --', name: '-- Grafana --', type: 'datasource' }),
  '-- Mixed --': ds({ id: 5, uid: '-- Mixed --', name: '-- Mixed --', type: 'datasource' }),
};

const metas: DatasourcePluginMetas = {
  'test-db': pluginMeta('test-db', { alerting: true }),
  'default-db': pluginMeta('default-db'),
  loki: pluginMeta('loki', { aliasIDs: ['loki-alias'] }),
  grafana: pluginMeta('grafana'),
  mixed: pluginMeta('mixed'),
};

function logo(meta: DataSourcePluginMeta | undefined): string | undefined {
  return meta?.info.logos.small;
}

beforeEach(() => {
  setDataSourceInstanceSettings(instances, 'Bravo');
  setDatasourcePluginMetas(metas);
});

describe('getDataSourceInstanceMeta', () => {
  it('resolves by uid', async () => {
    const meta = await getDataSourceInstanceMeta('uid-alpha');

    expect(meta?.id).toBe('test-db');
    expect(meta?.alerting).toBe(true);
  });

  it('resolves by name', async () => {
    expect((await getDataSourceInstanceMeta('Alpha'))?.id).toBe('test-db');
  });

  it('resolves by stringified id', async () => {
    expect((await getDataSourceInstanceMeta('1'))?.id).toBe('test-db');
  });

  it('resolves by DataSourceRef', async () => {
    expect((await getDataSourceInstanceMeta({ uid: 'uid-alpha', type: 'test-db' }))?.id).toBe('test-db');
  });

  it('returns the plugin meta, not the copy embedded on the instance settings', async () => {
    expect(logo(await getDataSourceInstanceMeta('uid-alpha'))).toBe('test-db-plugin-logo.svg');
    expect(logo(instances.Alpha.meta)).toBe('instance-logo.svg');
  });

  it('resolves an instance whose type is a plugin alias id', async () => {
    expect((await getDataSourceInstanceMeta('uid-aliased'))?.id).toBe('loki');
  });

  it.each([
    ['-- Grafana --', 'grafana'],
    ['-- Mixed --', 'mixed'],
  ])('maps the built-in %s to the %s plugin meta', async (uid, pluginId) => {
    expect((await getDataSourceInstanceMeta(uid))?.id).toBe(pluginId);
  });

  it.each([undefined, null, 'default'])('resolves the default data source for ref %p', async (ref) => {
    expect((await getDataSourceInstanceMeta(ref))?.id).toBe('default-db');
  });

  it('returns undefined for an unknown ref', async () => {
    expect(await getDataSourceInstanceMeta('nonexistent')).toBeUndefined();
  });

  it('falls back to the instance meta when the plugin meta cache has no entry', async () => {
    upsertRuntimeDataSourceInstanceSettings(
      ds({
        id: 9,
        uid: 'uid-runtime',
        name: 'Runtime',
        type: 'runtime-db',
        meta: pluginMeta('runtime-db', {
          info: { ...pluginMeta('runtime-db').info, logos: { small: 'runtime-instance-logo.svg', large: '' } },
        }),
      })
    );

    expect(logo(await getDataSourceInstanceMeta('uid-runtime'))).toBe('runtime-instance-logo.svg');
  });
});
