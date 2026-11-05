import {
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  PluginType,
  type ScopedVars,
} from '@grafana/data';

import { setDatasourcePluginMetas } from '../pluginMeta/datasources';
import { type DatasourcePluginMetas } from '../pluginMeta/types';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import { setExpressionDataSourceInstance } from './expressionDs';
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
    });
  });

  it('accepts a DataSourceRef carrying a uid', async () => {
    expect((await getDataSourceInstanceListItem({ uid: 'uid-alpha', type: 'test-db' }))?.name).toBe('Alpha');
  });

  it('ignores the ref type and resolves purely on uid', async () => {
    // A mismatched type must not change the result — the uid is the only key.
    expect((await getDataSourceInstanceListItem({ uid: 'uid-alpha', type: 'not-the-real-type' }))?.name).toBe('Alpha');
  });

  it('does not carry the isDefault flag of the instance settings', async () => {
    expect(instances.Bravo.isDefault).toBe(true);
    expect(await getDataSourceInstanceListItem('uid-bravo')).not.toHaveProperty('isDefault');
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

  it('resolves a runtime-registered data source and falls back to its instance meta', async () => {
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

  it.each(['__expr__', '-100'])('resolves the expression data source by uid %p', async (uid) => {
    const expressionSettings = ds({ id: 0, uid: '__expr__', name: 'Expression', type: '__expr__' });
    setExpressionDataSourceInstance({ instanceSettings: expressionSettings } as unknown as DataSourceApi);

    expect((await getDataSourceInstanceListItem(uid))?.name).toBe('Expression');
  });

  describe('resolves legacy refs like getDataSourceInstanceSettings', () => {
    it('resolves a name', async () => {
      expect((await getDataSourceInstanceListItem('Alpha'))?.uid).toBe('uid-alpha');
    });

    it('resolves a stringified numeric id', async () => {
      expect((await getDataSourceInstanceListItem('1'))?.uid).toBe('uid-alpha');
    });

    it.each([undefined, null, 'default'])('resolves ref %p to the default data source', async (ref) => {
      expect((await getDataSourceInstanceListItem(ref))?.uid).toBe('uid-bravo');
    });

    it('resolves a type-only ref to the default of that type', async () => {
      expect((await getDataSourceInstanceListItem({ type: 'test-db' }))?.uid).toBe('uid-alpha');
    });

    it('resolves an unmatched type-only ref to the -- Grafana -- built-in', async () => {
      expect((await getDataSourceInstanceListItem({ type: 'nonexistent' }))?.uid).toBe('-- Grafana --');
    });

    it('resolves a template variable ref against the global variables', async () => {
      setTemplateSrv({
        replace: (target?: string) => target?.replace('${myds}', 'uid-alpha') ?? '',
      } as unknown as TemplateSrv);

      expect((await getDataSourceInstanceListItem('${myds}'))?.uid).toBe('uid-alpha');
      expect((await getDataSourceInstanceListItem({ uid: '${myds}' }))?.uid).toBe('uid-alpha');
    });

    it('interpolates a template variable ref with scopedVars', async () => {
      setTemplateSrv({
        replace: (target?: string, scopedVars?: ScopedVars) =>
          target?.replace('${myds}', String(scopedVars?.myds?.value)) ?? '',
      } as unknown as TemplateSrv);

      expect(
        (await getDataSourceInstanceListItem('${myds}', { myds: { text: 'Bravo', value: 'uid-bravo' } }))?.uid
      ).toBe('uid-bravo');
    });

    it('returns undefined for an unknown uid', async () => {
      expect(await getDataSourceInstanceListItem('nonexistent')).toBeUndefined();
    });
  });
});
