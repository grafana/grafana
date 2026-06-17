import { DataSourceApi, type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import { RuntimeDataSource } from '../RuntimeDataSource';
import { type DataSourceSrv, setDataSourceSrv } from '../dataSourceSrv';
import { setLogger } from '../logging/registry';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import { FALLBACK_TO_LEGACY_INSTANCE_WARNING } from './constants';
import {
  _resetForTests as resetPlugin,
  getDataSourceInstance,
  registerRuntimeDataSourceInstance,
  setDataSourcePluginImporter,
} from './dataSource';
import { setExpressionDataSourceInstance } from './expressionDs';
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

const logError = jest.fn();
const logWarning = jest.fn();

beforeEach(() => {
  resetInstanceSettings();
  resetPlugin();
  resetPluginCache();
  logError.mockClear();
  logWarning.mockClear();
  setLogger('grafana/runtime.plugins.datasource', {
    logDebug: jest.fn(),
    logError,
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning,
  });
  // No legacy srv by default — the fallback should be inert.
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
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

    it('logs the failure with the raw error as cause and does not sanitize the rethrow', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      const importError = new Error('module not found');
      setDataSourcePluginImporter(jest.fn().mockRejectedValue(importError));

      await expect(getDataSourceInstance(settings.uid)).rejects.toBe(importError);

      expect(logError).toHaveBeenCalledTimes(1);
      const [loggedError] = logError.mock.calls[0];
      expect(loggedError).toBeInstanceOf(Error);
      expect(loggedError.cause).toBe(importError);
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

    describe('reference resolution parity with DatasourceSrv.get', () => {
      // Two test-db sources, Bravo is the default.
      const seedAlphaBravo = () => {
        const alpha = ds();
        const bravo = ds({ id: 2, uid: 'uid-bravo', name: 'Bravo', isDefault: true });
        initDataSourceInstanceSettings({ [alpha.name]: alpha, [bravo.name]: bravo }, bravo.name);
        return { alpha, bravo };
      };

      const importerReturning = (instance: unknown) => {
        const MockClass = jest.fn().mockReturnValue(instance);
        setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));
        return MockClass;
      };

      it('loads the configured default datasource when ref is null', async () => {
        const { bravo } = seedAlphaBravo();
        const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
        const MockClass = importerReturning(instance);

        const result = await getDataSourceInstance(null);

        expect(MockClass).toHaveBeenCalledWith(bravo);
        expect(result).toBe(instance);
      });

      it('resolves a type-only ref to the default datasource of that type', async () => {
        const { bravo } = seedAlphaBravo();
        const MockClass = importerReturning(Object.create(DataSourceApi.prototype));

        await getDataSourceInstance({ type: 'test-db' });

        expect(MockClass).toHaveBeenCalledWith(bravo);
      });

      it('falls back to the configured default for a type-only ref with no match', async () => {
        const { bravo } = seedAlphaBravo();
        const MockClass = importerReturning(Object.create(DataSourceApi.prototype));

        await getDataSourceInstance({ type: 'does-not-exist' });

        expect(MockClass).toHaveBeenCalledWith(bravo);
      });

      // Divergence from legacy DatasourceSrv.get(), which short-circuits expression refs to a
      // preloaded singleton instance. getDataSourceInstance has no such short-circuit yet.
      // Tracked in the async-vs-legacy divergences issue.
      it.todo('resolves expression refs to the preloaded singleton without importing');
    });

    it('passes settings.meta to the importer', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const mockImport = jest.fn().mockResolvedValue({
        DataSourceClass: jest.fn().mockReturnValue(Object.create(DataSourceApi.prototype)),
        components: {},
      });
      setDataSourcePluginImporter(mockImport);

      await getDataSourceInstance(settings.uid);

      expect(mockImport).toHaveBeenCalledWith(settings.meta);
    });

    it('patches legacy plugins that do not extend DataSourceApi', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      // A plain object instance — NOT an instanceof DataSourceApi — must be patched.
      const legacyInstance: Record<string, unknown> = {};
      const MockClass = jest.fn().mockReturnValue(legacyInstance);
      setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));

      const result = (await getDataSourceInstance(settings.uid)) as unknown as Record<string, unknown>;

      expect(result.name).toBe(settings.name);
      expect(result.id).toBe(settings.id);
      expect(result.type).toBe(settings.type);
      expect(result.meta).toBe(settings.meta);
      expect(result.uid).toBe(settings.uid);
      expect((result.getRef as () => unknown)()).toEqual({ type: settings.type, uid: settings.uid });
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

    it('survives a reload (state is in expressionDs module, independent of the plugin cache)', async () => {
      initDataSourceInstanceSettings({}, '');
      const expr = registerExpression();

      jest.spyOn(require('../../services/backendSrv'), 'getBackendSrv').mockReturnValue({
        get: jest.fn().mockResolvedValue({ datasources: {}, defaultDatasource: '' }),
      });
      await reloadDataSourceInstanceSettings();

      expect(await getDataSourceInstance('__expr__')).toBe(expr);
    });

    it('throws if the singleton has not been registered', async () => {
      initDataSourceInstanceSettings({}, '');
      await expect(getDataSourceInstance('__expr__')).rejects.toThrow('Expression datasource has not been initialised');
    });
  });

  describe('legacy DataSourceSrv fallback', () => {
    it('falls back to the legacy srv and logs a warning when the new path cannot resolve the instance', async () => {
      // Empty cache so the new path throws "not found".
      initDataSourceInstanceSettings({}, '');
      setDataSourcePluginImporter(jest.fn());

      const legacyInstance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const get = jest.fn().mockResolvedValue(legacyInstance);
      // getInstanceSettings also misses, so the settings-level fallback stays silent and the
      // instance-level fallback is what resolves the instance.
      const getInstanceSettings = jest.fn().mockReturnValue(undefined);
      setDataSourceSrv({ get, getInstanceSettings } as unknown as DataSourceSrv);

      const result = await getDataSourceInstance('unknown-uid');

      expect(result).toBe(legacyInstance);
      expect(get).toHaveBeenCalledWith('unknown-uid', undefined);
      expect(logWarning).toHaveBeenCalledTimes(1);
      expect(logWarning).toHaveBeenCalledWith(FALLBACK_TO_LEGACY_INSTANCE_WARNING, { ref: 'unknown-uid' });
    });

    it('rethrows the original error and does not log when the legacy srv also cannot resolve it', async () => {
      initDataSourceInstanceSettings({}, '');
      setDataSourcePluginImporter(jest.fn());

      const get = jest.fn().mockRejectedValue(new Error('legacy not found'));
      const getInstanceSettings = jest.fn().mockReturnValue(undefined);
      setDataSourceSrv({ get, getInstanceSettings } as unknown as DataSourceSrv);

      await expect(getDataSourceInstance('unknown-uid')).rejects.toThrow(/was not found/);
      expect(logWarning).not.toHaveBeenCalled();
    });

    it('does not consult the legacy srv when the new path succeeds', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      setDataSourcePluginImporter(
        jest.fn().mockResolvedValue({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} })
      );
      const get = jest.fn();
      setDataSourceSrv({ get } as unknown as DataSourceSrv);

      const result = await getDataSourceInstance(settings.uid);

      expect(result).toBe(instance);
      expect(get).not.toHaveBeenCalled();
      expect(logWarning).not.toHaveBeenCalled();
    });

    it('routes a concurrent in-flight caller through the fallback when the load rejects', async () => {
      const settings = ds();
      initDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      // A deferred import so the first caller's load stays in-flight while the second arrives.
      let rejectImport: (err: Error) => void = () => {};
      const importPromise = new Promise((_, reject) => {
        rejectImport = reject;
      });
      setDataSourcePluginImporter(jest.fn().mockReturnValue(importPromise));

      const legacyInstance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const get = jest.fn().mockResolvedValue(legacyInstance);
      setDataSourceSrv({ get } as unknown as DataSourceSrv);

      // First caller starts the load; the second reuses the in-flight promise.
      const first = getDataSourceInstance(settings.uid);
      const second = getDataSourceInstance(settings.uid);

      // Let both reach their await points (first awaiting the load, second awaiting in-flight).
      await new Promise((resolve) => setTimeout(resolve, 0));
      rejectImport(new Error('module not found'));

      // Both callers — including the in-flight one — fall back to the legacy instance.
      await expect(first).resolves.toBe(legacyInstance);
      await expect(second).resolves.toBe(legacyInstance);
      expect(get).toHaveBeenCalledTimes(2);
      expect(logWarning).toHaveBeenCalledTimes(2);
    });
  });
});
