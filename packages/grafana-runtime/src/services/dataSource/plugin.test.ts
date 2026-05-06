import { DataSourceApi, type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import { invalidateCachedPromisesCache } from '../../utils/getCachedPromise';
import { RuntimeDataSource } from '../RuntimeDataSource';

import { _resetForTests as resetInstanceSettings, init, reload } from './instanceSettings';
import {
  _resetForTests as resetPlugin,
  getDataSourcePlugin,
  registerRuntimeDataSource,
  setDataSourceImporter,
} from './plugin';
import { _resetForTests as resetPluginCache } from './pluginCache';

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
  describe('getDataSourcePlugin', () => {
    it('loads and returns a datasource instance', async () => {
      const settings = ds();
      init({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      setDataSourceImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));

      const result = await getDataSourcePlugin(settings.uid);

      expect(MockClass).toHaveBeenCalledWith(settings);
      expect(result).toBe(instance);
    });

    it('caches the instance and does not call the importer twice', async () => {
      const settings = ds();
      init({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const mockImport = jest.fn().mockResolvedValue({
        DataSourceClass: jest.fn().mockReturnValue(instance),
        components: {},
      });
      setDataSourceImporter(mockImport);

      const first = await getDataSourcePlugin(settings.uid);
      const second = await getDataSourcePlugin(settings.uid);

      expect(mockImport).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('throws when the datasource is not found', async () => {
      init({}, '');
      setDataSourceImporter(jest.fn());

      await expect(getDataSourcePlugin('unknown-uid')).rejects.toThrow(/was not found/);
    });

    it('throws when the importer has not been set', async () => {
      const settings = ds();
      init({ [settings.name]: settings }, settings.name);

      await expect(getDataSourcePlugin(settings.uid)).rejects.toThrow(/has not been set/);
    });
  });

  describe('registerRuntimeDataSource', () => {
    it('makes the runtime instance available via getDataSourcePlugin', async () => {
      init({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSource({ dataSource: runtime });

      const result = await getDataSourcePlugin('runtime-uid');
      expect(result).toBe(runtime);
    });

    it('throws on duplicate uid', () => {
      init({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSource({ dataSource: runtime });
      const duplicate = new TestRuntime('plugin-id', 'runtime-uid');
      expect(() => registerRuntimeDataSource({ dataSource: duplicate })).toThrow(/already been registered/);
    });
  });

  describe('reload', () => {
    it('clears non-runtime plugin instances so they are rebuilt from fresh settings', async () => {
      const settings = ds();
      init({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      const mockImport = jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} });
      setDataSourceImporter(mockImport);

      // Prime the cache.
      await getDataSourcePlugin(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(1);

      // Simulate a reload — backend returns the same settings for simplicity.
      jest.spyOn(require('../../services/backendSrv'), 'getBackendSrv').mockReturnValue({
        get: jest.fn().mockResolvedValue({
          datasources: { [settings.name]: settings },
          defaultDatasource: settings.name,
        }),
      });
      await reload();

      // The importer must be called again because the cache was cleared.
      await getDataSourcePlugin(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(2);
    });

    it('preserves runtime plugin instances across reload', async () => {
      init({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSource({ dataSource: runtime });

      jest.spyOn(require('../../services/backendSrv'), 'getBackendSrv').mockReturnValue({
        get: jest.fn().mockResolvedValue({ datasources: {}, defaultDatasource: '' }),
      });
      await reload();

      const result = await getDataSourcePlugin('runtime-uid');
      expect(result).toBe(runtime);
    });
  });
});
