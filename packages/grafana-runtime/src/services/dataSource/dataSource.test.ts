import { DataSourceApi, type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import { RuntimeDataSource } from '../RuntimeDataSource';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import {
  _resetForTests as resetPlugin,
  getDataSourceInstance,
  registerRuntimeDataSourceInstance,
  setDataSourcePluginImporter,
  setExpressionDataSourceInstance,
} from './dataSource';
import { _resetForTests as resetPluginCache } from './pluginCache';
import {
  _resetForTests as resetInstanceSettings,
  initDataSourceInstanceSettings,
  reloadDataSourceInstanceSettings,
  syncDataSourceInstanceSettings,
} from './settings';

class TestRuntime extends RuntimeDataSource {
  query() {
    return Promise.resolve({ data: [] });
  }
}

function ds(overrides: Partial<DataSourceInstanceSettings> = {}): DataSourceInstanceSettings {
  return {
    id: 1,
    uid: 'uid-alpha',
    name: 'Alpha',
    type: 'test-db',
    access: 'direct',
    jsonData: {},
    readOnly: false,
    meta: {
      id: 'test-db',
      name: 'Test DB',
      type: 'datasource',
      module: '',
      baseUrl: '',
      info: {
        author: { name: '' },
        description: '',
        links: [],
        logos: { small: '', large: '' },
        screenshots: [],
        updated: '',
        version: '',
      },
      metrics: true,
    } as DataSourcePluginMeta,
    ...overrides,
  } as DataSourceInstanceSettings;
}

beforeEach(() => {
  resetInstanceSettings();
  resetPlugin();
  resetPluginCache();
});

describe('plugin', () => {
  describe('getDataSourceInstance', () => {
    it('loads and returns a datasource instance', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));

      const result = await getDataSourceInstance(settings.uid);

      expect(MockClass).toHaveBeenCalledWith(settings);
      expect(result).toBe(instance);
    });

    it('caches the instance and does not call the importer twice', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const mockImport = jest.fn().mockResolvedValue({
        DataSourceClass: jest.fn().mockReturnValue(instance),
        components: {},
      });
      setDataSourcePluginImporter(mockImport);

      const first = await getDataSourceInstance(settings.uid);
      const second = await getDataSourceInstance(settings.uid);

      expect(mockImport).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('throws when the datasource is not found', async () => {
      initDataSourceInstanceSettings({}, '');
      setDataSourcePluginImporter(jest.fn());

      await expect(getDataSourceInstance('unknown-uid')).rejects.toThrow(/was not found/);
    });

    it('throws when the importer has not been set', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      await expect(getDataSourceInstance(settings.uid)).rejects.toThrow(/has not been set/);
    });

    it('caches under the resolved uid when ref is a template variable', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      setTemplateSrv({
        getVariables: () => [],
        replace: (v?: string) => (v === '${myds}' ? settings.name : (v ?? '')),
      } as unknown as TemplateSrv);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));

      const result = await getDataSourceInstance('${myds}');
      expect(result).toBe(instance);

      // Cached under the real uid — subsequent call via real uid returns the same instance.
      const second = await getDataSourceInstance(settings.uid);
      expect(second).toBe(instance);
      expect(MockClass).toHaveBeenCalledTimes(1);
    });

    it('throws when the plugin import fails', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      setDataSourcePluginImporter(jest.fn().mockRejectedValue(new Error('module not found')));

      await expect(getDataSourceInstance(settings.uid)).rejects.toThrow(/module not found/);
    });

    it('returns the same instance for name-based and uid-based lookups', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const mockImport = jest.fn().mockResolvedValue({
        DataSourceClass: jest.fn().mockReturnValue(instance),
        components: {},
      });
      setDataSourcePluginImporter(mockImport);

      const byUid = await getDataSourceInstance(settings.uid);
      const byName = await getDataSourceInstance(settings.name);

      expect(byUid).toBe(byName);
      expect(mockImport).toHaveBeenCalledTimes(1);
    });

    it('resolves a template variable that interpolates to default', async () => {
      const alpha = ds();
      const bravo = ds({ id: 2, uid: 'uid-bravo', name: 'Bravo', type: 'test-db' });
      initDataSourceInstanceSettings({ [alpha.name]: alpha, [bravo.name]: bravo }, bravo.name);
      setTemplateSrv({
        getVariables: () => [],
        replace: (v?: string) => (v === '${dsVar}' ? 'default' : (v ?? '')),
      } as unknown as TemplateSrv);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      setDataSourcePluginImporter(
        jest.fn().mockResolvedValue({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} })
      );

      const result = await getDataSourceInstance('${dsVar}');
      expect(result).toBe(instance);
    });
  });

  describe('registerRuntimeDataSourceInstance', () => {
    it('makes the runtime instance available via getDataSourceInstance', async () => {
      initDataSourceInstanceSettings({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSourceInstance({ dataSource: runtime });

      const result = await getDataSourceInstance('runtime-uid');
      expect(result).toBe(runtime);
    });

    it('throws on duplicate uid', () => {
      initDataSourceInstanceSettings({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSourceInstance({ dataSource: runtime });
      const duplicate = new TestRuntime('plugin-id', 'runtime-uid');
      expect(() => registerRuntimeDataSourceInstance({ dataSource: duplicate })).toThrow(/already been registered/);
    });
  });

  describe('reload', () => {
    it('clears non-runtime plugin instances so they are rebuilt from fresh settings', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      const mockImport = jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} });
      setDataSourcePluginImporter(mockImport);

      // Prime the cache.
      await getDataSourceInstance(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(1);

      // Simulate a reload — backend returns the same settings for simplicity.
      jest.spyOn(require('../../services/backendSrv'), 'getBackendSrv').mockReturnValue({
        get: jest.fn().mockResolvedValue({
          datasources: { [settings.name]: settings },
          defaultDatasource: settings.name,
        }),
      });
      await reloadDataSourceInstanceSettings();

      // The importer must be called again because the cache was cleared.
      await getDataSourceInstance(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(2);
    });

    it('clears non-runtime plugin instances on syncDataSourceInstanceSettings so they are rebuilt', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      const mockImport = jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} });
      setDataSourcePluginImporter(mockImport);

      // Prime the cache.
      await getDataSourceInstance(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(1);

      // Sync from an already-fetched payload — no network round trip.
      syncDataSourceInstanceSettings({
        datasources: { [settings.name]: settings },
        defaultDatasource: settings.name,
      });

      // The importer must be called again because the cache was cleared.
      await getDataSourceInstance(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(2);
    });

    it('preserves runtime plugin instances across reload', async () => {
      initDataSourceInstanceSettings({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSourceInstance({ dataSource: runtime });

      jest.spyOn(require('../../services/backendSrv'), 'getBackendSrv').mockReturnValue({
        get: jest.fn().mockResolvedValue({ datasources: {}, defaultDatasource: '' }),
      });
      await reloadDataSourceInstanceSettings();

      const result = await getDataSourceInstance('runtime-uid');
      expect(result).toBe(runtime);
    });
  });

  describe('expression short-circuit', () => {
    function registerExpression(): DataSourceApi {
      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      // The expression singleton retains its full instance settings as a public field.
      (instance as unknown as { instanceSettings: DataSourceInstanceSettings }).instanceSettings = ds({
        id: 0,
        uid: '__expr__',
        name: 'Expression',
        type: '__expr__',
      });
      setExpressionDataSourceInstance(instance);
      return instance;
    }

    it('returns the registered singleton without importing a plugin', async () => {
      initDataSourceInstanceSettings({}, '');
      const expr = registerExpression();
      const mockImport = jest.fn();
      setDataSourcePluginImporter(mockImport);

      const result = await getDataSourceInstance('__expr__');

      expect(result).toBe(expr);
      expect(mockImport).not.toHaveBeenCalled();
    });

    it('resolves legacy id -100 and name Expression to the same singleton', async () => {
      initDataSourceInstanceSettings({}, '');
      const expr = registerExpression();
      setDataSourcePluginImporter(jest.fn());

      expect(await getDataSourceInstance('-100')).toBe(expr);
      expect(await getDataSourceInstance('Expression')).toBe(expr);
    });

    it('resolves a DataSourceRef with the expression type', async () => {
      initDataSourceInstanceSettings({}, '');
      const expr = registerExpression();
      setDataSourcePluginImporter(jest.fn());

      const result = await getDataSourceInstance({ type: '__expr__', uid: '__expr__' });
      expect(result).toBe(expr);
    });

    it('survives a reload (stored as a runtime cache entry)', async () => {
      initDataSourceInstanceSettings({}, '');
      const expr = registerExpression();

      jest.spyOn(require('../../services/backendSrv'), 'getBackendSrv').mockReturnValue({
        get: jest.fn().mockResolvedValue({ datasources: {}, defaultDatasource: '' }),
      });
      await reloadDataSourceInstanceSettings();

      expect(await getDataSourceInstance('__expr__')).toBe(expr);
    });
  });
});
