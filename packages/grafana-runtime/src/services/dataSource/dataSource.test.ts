import { DataSourceApi, type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import { invalidateCachedPromisesCache } from '../../utils/getCachedPromise';
import { RuntimeDataSource } from '../RuntimeDataSource';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import {
  _resetForTests as resetPlugin,
  getDataSourceInstance,
  registerRuntimeDataSource,
  setDataSourceImporter,
} from './dataSource';
import { _resetForTests as resetPluginCache } from './pluginCache';
import { _resetForTests as resetInstanceSettings, initDataSources, reloadDataSources } from './settings';

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
  invalidateCachedPromisesCache();
});

describe('plugin', () => {
  describe('getDataSourceInstance', () => {
    it('loads and returns a datasource instance', async () => {
      const settings = ds();
      initDataSources({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      setDataSourceImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));

      const result = await getDataSourceInstance(settings.uid);

      expect(MockClass).toHaveBeenCalledWith(settings);
      expect(result).toBe(instance);
    });

    it('caches the instance and does not call the importer twice', async () => {
      const settings = ds();
      initDataSources({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const mockImport = jest.fn().mockResolvedValue({
        DataSourceClass: jest.fn().mockReturnValue(instance),
        components: {},
      });
      setDataSourceImporter(mockImport);

      const first = await getDataSourceInstance(settings.uid);
      const second = await getDataSourceInstance(settings.uid);

      expect(mockImport).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('throws when the datasource is not found', async () => {
      initDataSources({}, '');
      setDataSourceImporter(jest.fn());

      await expect(getDataSourceInstance('unknown-uid')).rejects.toThrow(/was not found/);
    });

    it('throws when the importer has not been set', async () => {
      const settings = ds();
      initDataSources({ [settings.name]: settings }, settings.name);

      await expect(getDataSourceInstance(settings.uid)).rejects.toThrow(/has not been set/);
    });

    it('caches under the resolved uid when ref is a template variable', async () => {
      const settings = ds();
      initDataSources({ [settings.name]: settings }, settings.name);
      setTemplateSrv({
        getVariables: () => [],
        replace: (v?: string) => (v === '${myds}' ? settings.name : (v ?? '')),
      } as unknown as TemplateSrv);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      setDataSourceImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));

      const result = await getDataSourceInstance('${myds}');
      expect(result).toBe(instance);

      // Cached under the real uid — subsequent call via real uid returns the same instance.
      const second = await getDataSourceInstance(settings.uid);
      expect(second).toBe(instance);
      expect(MockClass).toHaveBeenCalledTimes(1);
    });

    it('throws when the plugin import fails', async () => {
      const settings = ds();
      initDataSources({ [settings.name]: settings }, settings.name);
      setDataSourceImporter(jest.fn().mockRejectedValue(new Error('module not found')));

      await expect(getDataSourceInstance(settings.uid)).rejects.toThrow(/module not found/);
    });

    it('returns the same instance for name-based and uid-based lookups', async () => {
      const settings = ds();
      initDataSources({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const mockImport = jest.fn().mockResolvedValue({
        DataSourceClass: jest.fn().mockReturnValue(instance),
        components: {},
      });
      setDataSourceImporter(mockImport);

      const byUid = await getDataSourceInstance(settings.uid);
      const byName = await getDataSourceInstance(settings.name);

      expect(byUid).toBe(byName);
      expect(mockImport).toHaveBeenCalledTimes(1);
    });

    it('resolves a template variable that interpolates to default', async () => {
      const alpha = ds();
      const bravo = ds({ id: 2, uid: 'uid-bravo', name: 'Bravo', type: 'test-db' });
      initDataSources({ [alpha.name]: alpha, [bravo.name]: bravo }, bravo.name);
      setTemplateSrv({
        getVariables: () => [],
        replace: (v?: string) => (v === '${dsVar}' ? 'default' : (v ?? '')),
      } as unknown as TemplateSrv);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      setDataSourceImporter(
        jest.fn().mockResolvedValue({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} })
      );

      const result = await getDataSourceInstance('${dsVar}');
      expect(result).toBe(instance);
    });
  });

  describe('registerRuntimeDataSource', () => {
    it('makes the runtime instance available via getDataSourceInstance', async () => {
      initDataSources({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSource({ dataSource: runtime });

      const result = await getDataSourceInstance('runtime-uid');
      expect(result).toBe(runtime);
    });

    it('throws on duplicate uid', () => {
      initDataSources({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSource({ dataSource: runtime });
      const duplicate = new TestRuntime('plugin-id', 'runtime-uid');
      expect(() => registerRuntimeDataSource({ dataSource: duplicate })).toThrow(/already been registered/);
    });
  });

  describe('reload', () => {
    it('clears non-runtime plugin instances so they are rebuilt from fresh settings', async () => {
      const settings = ds();
      initDataSources({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      const mockImport = jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} });
      setDataSourceImporter(mockImport);

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
      await reloadDataSources();

      // The importer must be called again because the cache was cleared.
      await getDataSourceInstance(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(2);
    });

    it('preserves runtime plugin instances across reload', async () => {
      initDataSources({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSource({ dataSource: runtime });

      jest.spyOn(require('../../services/backendSrv'), 'getBackendSrv').mockReturnValue({
        get: jest.fn().mockResolvedValue({ datasources: {}, defaultDatasource: '' }),
      });
      await reloadDataSources();

      const result = await getDataSourceInstance('runtime-uid');
      expect(result).toBe(runtime);
    });
  });
});
