import { type DataSourceInstanceSettings, type DataSourcePluginMeta, PluginType } from '@grafana/data';

import { setDatasourcePluginMetas } from '../pluginMeta/datasources';
import { type DatasourcePluginMetas } from '../pluginMeta/types';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import { getDataSourceInstanceListItem } from './listItem';
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

function instanceMeta(id: string, logoSmall: string): DataSourcePluginMeta {
  return pluginMeta(id, { info: { ...pluginMeta(id).info, logos: { small: logoSmall, large: '' } } });
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
    // Deliberately distinguishable from the plugin meta of the same id: every assertion that
    // expects a `*-plugin-logo.svg` proves the plugin meta cache was the source.
    meta: instanceMeta('test-db', 'instance-logo.svg'),
    ...overrides,
  } as DataSourceInstanceSettings;
}

const instances: Record<string, DataSourceInstanceSettings> = {
  Alpha: ds({ id: 1, uid: 'uid-alpha', name: 'Alpha', type: 'test-db' }),
  Bravo: ds({ id: 2, uid: 'uid-bravo', name: 'Bravo', type: 'default-db', isDefault: true }),
  Aliased: ds({ id: 3, uid: 'uid-aliased', name: 'Aliased', type: 'loki-alias' }),
  // Built-ins arrive from boot data with the plugin *type* as their instance type, not their
  // plugin id (see getFSDataSources in pkg/api/bootdata.go) — the case that makes the
  // name-based mapping in getDataSourceInstanceListItem necessary.
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

const templateSrv = {
  getVariables: () => [],
  replace: (value?: string) => (value === '${myds}' ? 'Alpha' : (value ?? '')),
} as unknown as TemplateSrv;

beforeAll(() => {
  setTemplateSrv(templateSrv);
});

beforeEach(() => {
  setDataSourceInstanceSettings(instances, 'Bravo');
  setDatasourcePluginMetas(metas);
});

describe('getDataSourceInstanceListItem', () => {
  it('returns the slim shape for a known uid', async () => {
    expect(await getDataSourceInstanceListItem('uid-alpha')).toEqual({
      uid: 'uid-alpha',
      type: 'test-db',
      apiVersion: undefined,
      name: 'Alpha',
      meta: metas['test-db'],
      readOnly: false,
      isDefault: false,
    });
  });

  it.each([
    ['uid', 'uid-alpha'],
    ['name', 'Alpha'],
    ['stringified id', '1'],
  ])('resolves by %s', async (_label, ref) => {
    expect((await getDataSourceInstanceListItem(ref))?.name).toBe('Alpha');
  });

  it('resolves by DataSourceRef', async () => {
    expect((await getDataSourceInstanceListItem({ uid: 'uid-alpha', type: 'test-db' }))?.name).toBe('Alpha');
  });

  it('normalises a missing isDefault to false', async () => {
    expect(instances.Alpha.isDefault).toBeUndefined();
    expect((await getDataSourceInstanceListItem('uid-alpha'))?.isDefault).toBe(false);
  });

  it('carries the instance type, not the plugin id', async () => {
    // The built-ins are where the two diverge: instance type `datasource`, plugin id `grafana`.
    const item = await getDataSourceInstanceListItem('-- Grafana --');

    expect(item?.type).toBe('datasource');
    expect(item?.meta.id).toBe('grafana');
  });

  it('takes meta from the plugin meta cache, not the copy embedded on the instance settings', async () => {
    expect((await getDataSourceInstanceListItem('uid-alpha'))?.meta.info.logos.small).toBe('test-db-plugin-logo.svg');
    expect(instances.Alpha.meta.info.logos.small).toBe('instance-logo.svg');
  });

  it('exposes plugin capability flags from the plugin meta', async () => {
    expect((await getDataSourceInstanceListItem('uid-alpha'))?.meta.alerting).toBe(true);
  });

  it('resolves an instance whose type is a plugin alias id', async () => {
    expect((await getDataSourceInstanceListItem('uid-aliased'))?.meta.id).toBe('loki');
  });

  it.each([
    ['-- Grafana --', 'grafana'],
    ['-- Mixed --', 'mixed'],
  ])('maps the built-in %s to the %s plugin meta', async (uid, pluginId) => {
    expect((await getDataSourceInstanceListItem(uid))?.meta.id).toBe(pluginId);
  });

  it.each([undefined, null, 'default'])('resolves the default data source for ref %p', async (ref) => {
    expect((await getDataSourceInstanceListItem(ref))?.name).toBe('Bravo');
  });

  it('interpolates a template variable ref when scopedVars are supplied', async () => {
    // The one caller that needs the scopedVars param is
    // PanelDataPaneNext.resolvePreviousDatasourceTypes, whose query refs can be `${myds}`.
    expect((await getDataSourceInstanceListItem({ uid: '${myds}' }, {}))?.type).toBe('test-db');
  });

  it('returns undefined for an unknown ref', async () => {
    expect(await getDataSourceInstanceListItem('nonexistent')).toBeUndefined();
  });

  it('falls back to the instance meta when the plugin meta cache has no entry', async () => {
    upsertRuntimeDataSourceInstanceSettings(
      ds({
        id: 9,
        uid: 'uid-runtime',
        name: 'Runtime',
        type: 'runtime-db',
        meta: instanceMeta('runtime-db', 'runtime-instance-logo.svg'),
      })
    );

    expect((await getDataSourceInstanceListItem('uid-runtime'))?.meta.info.logos.small).toBe(
      'runtime-instance-logo.svg'
    );
  });
});
