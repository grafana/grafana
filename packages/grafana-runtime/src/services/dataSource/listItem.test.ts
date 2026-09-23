import {
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  PluginType,
} from '@grafana/data';

import { type DataSourceSrv, setDataSourceSrv } from '../dataSourceSrv';
import { setLogger } from '../logging/registry';
import { setDatasourcePluginMetas } from '../pluginMeta/datasources';
import { type DatasourcePluginMetas } from '../pluginMeta/types';

import { FALLBACK_TO_LEGACY_LIST_ITEM_WARNING } from './constants';
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

const logWarning = jest.fn();

beforeEach(() => {
  setDataSourceInstanceSettings(instances, 'Bravo');
  setDatasourcePluginMetas(metas);
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
  logWarning.mockClear();
  setLogger('grafana/runtime.plugins.datasource', {
    logDebug: jest.fn(),
    logInfo: jest.fn(),
    logError: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning,
  });
});

describe('getDataSourceInstanceListItem', () => {
  it('returns the slim shape for a known uid', async () => {
    expect(await getDataSourceInstanceListItem('uid-alpha')).toEqual({
      uid: 'uid-alpha',
      type: 'test-db',
      apiVersion: undefined,
      name: 'Alpha',
      meta: metas['test-db'],
      isDefault: false,
    });
  });

  it('accepts a DataSourceRef carrying a uid', async () => {
    expect((await getDataSourceInstanceListItem({ uid: 'uid-alpha', type: 'test-db' }))?.name).toBe('Alpha');
  });

  it('ignores the ref type and resolves purely on uid', async () => {
    // A mismatched type must not change the result — the uid is the only key.
    expect((await getDataSourceInstanceListItem({ uid: 'uid-alpha', type: 'not-the-real-type' }))?.name).toBe('Alpha');
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

  describe('legacy UID-only fallback', () => {
    const legacySettings = ds({ uid: 'legacy-uid', name: 'Legacy', id: 42 });
    const getDataSourceSettingsByUid = jest.fn();
    const getInstanceSettings = jest.fn();

    beforeEach(() => {
      getDataSourceSettingsByUid
        .mockReset()
        .mockImplementation((uid: string) => (uid === 'legacy-uid' ? legacySettings : undefined));
      getInstanceSettings.mockReset().mockReturnValue(legacySettings);
      setDataSourceSrv({ getDataSourceSettingsByUid, getInstanceSettings } as unknown as DataSourceSrv);
    });

    it('logs a legacy UID hit and enriches it with cached plugin metadata', async () => {
      expect(await getDataSourceInstanceListItem({ uid: 'legacy-uid' })).toEqual({
        uid: 'legacy-uid',
        type: 'test-db',
        name: 'Legacy',
        apiVersion: undefined,
        isDefault: false,
        meta: metas['test-db'],
      });
      expect(getDataSourceSettingsByUid).toHaveBeenCalledWith('legacy-uid');
      expect(logWarning).toHaveBeenCalledWith(FALLBACK_TO_LEGACY_LIST_ITEM_WARNING, { ref: 'legacy-uid' });
    });

    it('returns an async cache hit without consulting the legacy service', async () => {
      expect((await getDataSourceInstanceListItem('uid-alpha'))?.uid).toBe('uid-alpha');
      expect(getDataSourceSettingsByUid).not.toHaveBeenCalled();
      expect(logWarning).not.toHaveBeenCalled();
    });

    it.each(['Legacy', '42', 'default', '[[ds]]', '${ds}', 'missing-uid'])(
      'does not coerce or warn for legacy UID miss %s',
      async (ref) => {
        expect(await getDataSourceInstanceListItem(ref)).toBeUndefined();
        expect(getDataSourceSettingsByUid).toHaveBeenCalledWith(ref);
        expect(getInstanceSettings).not.toHaveBeenCalled();
        expect(logWarning).not.toHaveBeenCalled();
      }
    );

    it('keeps missing and type-only refs unresolved without consulting the legacy service', async () => {
      expect(await getDataSourceInstanceListItem({ type: 'test-db' })).toBeUndefined();
      expect(await getDataSourceInstanceListItem()).toBeUndefined();
      expect(await getDataSourceInstanceListItem('uid-alpha')).toMatchObject({ uid: 'uid-alpha' });
      expect(getDataSourceSettingsByUid).not.toHaveBeenCalled();
      expect(getInstanceSettings).not.toHaveBeenCalled();
    });

    it('tolerates a legacy service without the optional UID-only method', async () => {
      setDataSourceSrv({ getInstanceSettings } as unknown as DataSourceSrv);

      expect(await getDataSourceInstanceListItem('legacy-uid')).toBeUndefined();
      expect(await getDataSourceInstanceListItem('uid-alpha')).toMatchObject({ uid: 'uid-alpha' });
      expect(getInstanceSettings).not.toHaveBeenCalled();
      expect(logWarning).not.toHaveBeenCalled();
    });
  });

  describe('does not inherit the coercions of getDataSourceInstanceSettings', () => {
    it('returns undefined for a name instead of matching byName', async () => {
      expect(await getDataSourceInstanceListItem('Alpha')).toBeUndefined();
    });

    it('returns undefined for a stringified numeric id instead of matching byId', async () => {
      expect(await getDataSourceInstanceListItem('1')).toBeUndefined();
    });

    it.each([undefined, null, '', 'default'])(
      'returns undefined for ref %p instead of the default data source',
      async (ref) => {
        expect(await getDataSourceInstanceListItem(ref)).toBeUndefined();
      }
    );

    it('returns undefined for a type-only ref instead of the default of that type', async () => {
      expect(await getDataSourceInstanceListItem({ type: 'test-db' })).toBeUndefined();
    });

    it('returns undefined for an unresolvable type-only ref instead of the -- Grafana -- built-in', async () => {
      // getDataSourceInstanceSettings({ type: 'nonexistent' }) resolves to -- Grafana -- via
      // findByType; this API must not.
      expect(await getDataSourceInstanceListItem({ type: 'nonexistent' })).toBeUndefined();
    });

    it('returns undefined for an uninterpolated template variable ref', async () => {
      expect(await getDataSourceInstanceListItem('${myds}')).toBeUndefined();
      expect(await getDataSourceInstanceListItem({ uid: '${myds}' })).toBeUndefined();
    });

    it('returns undefined for an unknown uid', async () => {
      expect(await getDataSourceInstanceListItem('nonexistent')).toBeUndefined();
    });
  });
});
