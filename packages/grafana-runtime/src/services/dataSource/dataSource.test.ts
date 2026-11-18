import {
  AppEvents,
  DataSourceApi,
  type EventBus,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type TestDataSourceResponse,
} from '@grafana/data';

import { TracedError } from '../../utils/TracedError';
import { RuntimeDataSource } from '../RuntimeDataSource';
import { setAppEvents } from '../appEvents';
import { type DataSourceSrv, setDataSourceSrv } from '../dataSourceSrv';
import { setLogger } from '../logging/registry';
import { setDatasourcePluginMetas } from '../pluginMeta/datasources';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import {
  FALLBACK_TO_LEGACY_INSTANCE_WARNING,
  NUMERIC_ID_REF_WARNING,
  PLUGIN_CACHE_UID_MISMATCH_WARNING,
} from './constants';
import {
  _resetForTests as resetPlugin,
  getDataSourceInstance,
  registerRuntimeDataSourceInstance,
  setDataSourcePluginImporter,
} from './dataSource';
import { DataSourcePluginImportError } from './errors';
import { setExpressionDataSourceInstance } from './expressionDs';
import { getCachedPlugin, getRuntimePlugin, _resetForTests as resetPluginCache } from './pluginCache';
import {
  reloadDataSourceInstanceSettings,
  setDataSourceInstanceSettings,
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
  resetPlugin();
  resetPluginCache();
  // An empty map leaves the plugin meta cache uninitialized, so lookups miss and fall back to settings.meta.
  setDatasourcePluginMetas({});
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
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));

      const result = await getDataSourceInstance(settings.uid);

      expect(MockClass).toHaveBeenCalledWith(settings);
      expect(result).toBe(instance);
    });

    it('caches the instance and does not call the importer twice', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

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

    it('names getDataSourceInstance in the warning stack when it resolves a numeric id', async () => {
      const settings = ds({ id: 42 });
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      setDataSourcePluginImporter(
        jest.fn().mockResolvedValue({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} })
      );

      const result = await getDataSourceInstance('42');

      expect(result).toBe(instance);
      expect(logWarning).toHaveBeenCalledWith(
        NUMERIC_ID_REF_WARNING,
        expect.objectContaining({ id: '42', stack: expect.stringMatching(/at (async )?getDataSourceInstance \(/) })
      );
    });

    it('throws when the datasource is not found', async () => {
      setDataSourceInstanceSettings({}, '');
      setDataSourcePluginImporter(jest.fn());

      await expect(getDataSourceInstance('unknown-uid')).rejects.toThrow(/was not found/);
    });

    it('throws when the importer has not been set', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      await expect(getDataSourceInstance(settings.uid)).rejects.toThrow(/has not been set/);
    });

    it('caches under the resolved uid when ref is a template variable', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
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

    it('throws a DataSourcePluginImportError with the cause message when the plugin import fails', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      const importError = new Error('module not found');
      setDataSourcePluginImporter(jest.fn().mockRejectedValue(importError));

      const error = await getDataSourceInstance(settings.uid).catch((e) => e);

      expect(error).toBeInstanceOf(DataSourcePluginImportError);
      expect(error.message).toBe('module not found');
      expect(error.uid).toBe(settings.uid);
      expect(error.cause).toBe(importError);
      expect(error.stack).toBe(importError.stack);
    });

    it('logs a TracedError that preserves the original stack', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      const importError = new Error('module not found');
      setDataSourcePluginImporter(jest.fn().mockRejectedValue(importError));

      await expect(getDataSourceInstance(settings.uid)).rejects.toBeInstanceOf(DataSourcePluginImportError);

      expect(logError).toHaveBeenCalledTimes(1);
      const [loggedError] = logError.mock.calls[0];
      expect(loggedError).toBeInstanceOf(TracedError);
      expect(loggedError.message).toContain('Failed to import datasource plugin');
      expect(loggedError.cause).toBe(importError);
      expect(loggedError.stack).toBe(importError.stack);
    });

    it('returns the same instance for name-based and uid-based lookups', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

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
      setDataSourceInstanceSettings({ [alpha.name]: alpha, [bravo.name]: bravo }, bravo.name);
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

    it('resolves a template variable that interpolates to a numeric datasource id', async () => {
      // ds() carries id: 1. Legacy DatasourceSrv.get() reaches the id map because it interpolates
      // itself and then re-enters getInstanceSettings through its plain branch; the new path
      // resolves settings once and must find it on the first attempt.
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      setTemplateSrv({
        getVariables: () => [],
        replace: (v?: string) => (v === '${dsById}' ? String(settings.id) : (v ?? '')),
      } as unknown as TemplateSrv);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      setDataSourcePluginImporter(
        jest.fn().mockResolvedValue({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} })
      );

      const result = await getDataSourceInstance('${dsById}');

      expect(result).toBe(instance);
      expect(logWarning).not.toHaveBeenCalledWith(FALLBACK_TO_LEGACY_INSTANCE_WARNING, expect.anything());
    });

    it('resolves a template variable that is not at the start of the ref', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      setTemplateSrv({
        getVariables: () => [],
        replace: (v?: string) => (v === 'logs-${stage}-loki' ? settings.name : (v ?? '')),
      } as unknown as TemplateSrv);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      setDataSourcePluginImporter(
        jest.fn().mockResolvedValue({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} })
      );

      const result = await getDataSourceInstance('logs-${stage}-loki');
      expect(result).toBe(instance);
    });

    describe('reference resolution parity with DatasourceSrv.get', () => {
      // Two test-db sources, Bravo is the default.
      const seedAlphaBravo = () => {
        const alpha = ds();
        const bravo = ds({ id: 2, uid: 'uid-bravo', name: 'Bravo', isDefault: true });
        setDataSourceInstanceSettings({ [alpha.name]: alpha, [bravo.name]: bravo }, bravo.name);
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

      it('loads the configured default datasource when ref is an empty string', async () => {
        const { bravo } = seedAlphaBravo();
        const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
        const MockClass = importerReturning(instance);

        const result = await getDataSourceInstance('');

        expect(MockClass).toHaveBeenCalledWith(bravo);
        expect(result).toBe(instance);
        expect(logWarning).not.toHaveBeenCalled();
      });

      it('loads the configured default datasource when ref has an empty uid and no type', async () => {
        const { bravo } = seedAlphaBravo();
        const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
        const MockClass = importerReturning(instance);

        const result = await getDataSourceInstance({ uid: '' });

        expect(MockClass).toHaveBeenCalledWith(bravo);
        expect(result).toBe(instance);
        expect(logWarning).not.toHaveBeenCalled();
      });

      it('resolves a ref with an empty uid by its type', async () => {
        const { bravo } = seedAlphaBravo();
        const MockClass = importerReturning(Object.create(DataSourceApi.prototype));

        await getDataSourceInstance({ type: 'test-db', uid: '' });

        expect(MockClass).toHaveBeenCalledWith(bravo);
        expect(logWarning).not.toHaveBeenCalled();
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

    describe('instance identity parity with DatasourceSrv.get (template-variable refs)', () => {
      // Unlike the preset-instance mocks used elsewhere in this file, this class derives its
      // identity from the settings the loader passes to the constructor — the identity a real
      // plugin would have. Legacy get('$var') interpolates and returns the concrete instance,
      // so instance.uid must be the real uid, never the variable string.
      class CapturingDataSource extends DataSourceApi {
        query(): Promise<DataQueryResponse> {
          return Promise.resolve({ data: [] });
        }
        testDatasource(): Promise<TestDataSourceResponse> {
          return Promise.resolve({ status: 'success', message: '' });
        }
      }

      const seedAlphaWithVariable = (DataSourceClass: unknown = CapturingDataSource) => {
        const settings = ds();
        setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
        setTemplateSrv({
          getVariables: () => [],
          replace: (v?: string) => (v === '${myds}' ? settings.uid : (v ?? '')),
        } as unknown as TemplateSrv);
        setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass, components: {} }));
        return settings;
      };

      it('constructs the instance with the concrete identity on a cold cache', async () => {
        const settings = seedAlphaWithVariable();

        const result = await getDataSourceInstance('${myds}');

        expect(result.uid).toBe(settings.uid);
        expect(result.name).toBe(settings.name);
        expect(result.getRef()).toEqual({ type: settings.type, uid: settings.uid });
      });

      it('constructs the concrete default instance when the variable interpolates to "default"', async () => {
        const settings = ds();
        setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
        setTemplateSrv({
          getVariables: () => [],
          replace: (v?: string) => (v === '${myds}' ? 'default' : (v ?? '')),
        } as unknown as TemplateSrv);
        setDataSourcePluginImporter(
          jest.fn().mockResolvedValue({ DataSourceClass: CapturingDataSource, components: {} })
        );

        const result = await getDataSourceInstance('${myds}');

        expect(result.uid).toBe(settings.uid);
        expect(result.name).toBe(settings.name);
        expect(result.getRef()).toEqual({ type: settings.type, uid: settings.uid });
      });

      it('constructs the concrete instance when the variable arrives inside a ref object', async () => {
        const settings = seedAlphaWithVariable();

        const result = await getDataSourceInstance({ uid: '${myds}', type: '' });

        expect(result.uid).toBe(settings.uid);
        expect(result.name).toBe(settings.name);
        expect(result.getRef()).toEqual({ type: settings.type, uid: settings.uid });
      });

      it('does not poison the concrete-uid cache entry after a variable-ref call', async () => {
        const settings = seedAlphaWithVariable();

        const viaVariable = await getDataSourceInstance('${myds}');
        const viaUid = await getDataSourceInstance(settings.uid);

        expect(viaUid.uid).toBe(settings.uid);
        expect(viaUid.getRef()).toEqual({ type: settings.type, uid: settings.uid });
        expect(viaUid).toBe(viaVariable);
      });

      it('returns the concrete instance for a variable ref on a warm cache', async () => {
        const settings = seedAlphaWithVariable();

        const viaUid = await getDataSourceInstance(settings.uid);
        const viaVariable = await getDataSourceInstance('${myds}');

        expect(viaVariable).toBe(viaUid);
        expect(viaVariable.uid).toBe(settings.uid);
      });

      it('patches legacy plugins (not extending DataSourceApi) with the concrete identity', async () => {
        const legacyInstance: Record<string, unknown> = {};
        const settings = seedAlphaWithVariable(jest.fn().mockReturnValue(legacyInstance));

        const result = (await getDataSourceInstance('${myds}')) as unknown as Record<string, unknown>;

        expect(result.uid).toBe(settings.uid);
        expect(result.name).toBe(settings.name);
        expect((result.getRef as () => unknown)()).toEqual({ type: settings.type, uid: settings.uid });
      });

      it('warns when a plugin instance is cached under a key that does not match its uid', async () => {
        class MangledUidDataSource extends CapturingDataSource {
          constructor(instanceSettings: DataSourceInstanceSettings) {
            super(instanceSettings);
            // uid is readonly on DataSourceApi; a badly-behaved plugin can still overwrite it at runtime.
            (this as { uid: string }).uid = 'not-the-cache-key';
          }
        }
        const settings = seedAlphaWithVariable(MangledUidDataSource);

        await getDataSourceInstance(settings.uid);

        expect(logWarning).toHaveBeenCalledWith(PLUGIN_CACHE_UID_MISMATCH_WARNING, {
          cacheUid: settings.uid,
          instanceUid: 'not-the-cache-key',
        });
      });
    });

    it('passes the plugin meta to the importer when the plugin meta lookup finds it', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      const pluginMeta = { ...settings.meta, fromPluginMeta: true };
      setDatasourcePluginMetas({ 'test-db': pluginMeta });

      const mockImport = jest.fn().mockResolvedValue({
        DataSourceClass: jest.fn().mockReturnValue(Object.create(DataSourceApi.prototype)),
        components: {},
      });
      setDataSourcePluginImporter(mockImport);

      await getDataSourceInstance(settings.uid);

      expect(mockImport).toHaveBeenCalledWith(pluginMeta);
    });

    it('passes settings.meta to the importer when the plugin meta lookup misses', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

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
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      // A plain object instance — NOT an instanceof DataSourceApi — must be patched.
      const legacyInstance: Record<string, unknown> = {};
      const MockClass = jest.fn().mockReturnValue(legacyInstance);
      setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));

      const result = (await getDataSourceInstance(settings.uid)) as unknown as Record<string, unknown>;

      expect(result.name).toBe(settings.name);
      expect(result.id).toBe(settings.id);
      expect(result.type).toBe(settings.type);
      // The cache is seeded with a clone of the fixture, so compare by value rather than identity.
      expect(result.meta).toEqual(settings.meta);
      expect(result.uid).toBe(settings.uid);
      expect((result.getRef as () => unknown)()).toEqual({ type: settings.type, uid: settings.uid });
    });

    it('patches legacy plugins with the resolved plugin id and plugin meta', async () => {
      const settings = ds({ uid: '-- Grafana --', name: '-- Grafana --', type: 'datasource' });
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      const grafanaMeta = { ...settings.meta, id: 'grafana', fromPluginMeta: true };
      setDatasourcePluginMetas({ grafana: grafanaMeta });

      const MockClass = jest.fn().mockReturnValue({});
      setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} }));

      const result = (await getDataSourceInstance(settings.uid)) as unknown as Record<string, unknown>;

      expect(result.type).toBe('grafana');
      expect(result.meta).toEqual(grafanaMeta);
    });

    describe('plugin load failure', () => {
      const publish = jest.fn();

      beforeEach(() => {
        publish.mockClear();
        setAppEvents({ publish } as unknown as EventBus);
      });

      it('shows the "plugin failed" alert once', async () => {
        const settings = ds();
        setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
        setDataSourcePluginImporter(jest.fn().mockRejectedValue(new Error('module not found')));

        await expect(getDataSourceInstance(settings.uid)).rejects.toBeInstanceOf(DataSourcePluginImportError);

        expect(publish).toHaveBeenCalledTimes(1);
        expect(publish).toHaveBeenCalledWith({
          type: AppEvents.alertError.name,
          payload: ['Alpha plugin failed', 'Error: module not found'],
        });
      });

      it('treats a constructor that throws like a failed import', async () => {
        const settings = ds();
        setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
        const DataSourceClass = jest.fn(() => {
          throw new Error('bad constructor');
        });
        setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass, components: {} }));

        await expect(getDataSourceInstance(settings.uid)).rejects.toBeInstanceOf(DataSourcePluginImportError);
        expect(publish).toHaveBeenCalledTimes(1);
      });

      it('does not fall back to the legacy srv, so the plugin is not imported a second time', async () => {
        const settings = ds();
        setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
        setDataSourcePluginImporter(jest.fn().mockRejectedValue(new Error('module not found')));
        const get = jest.fn();
        setDataSourceSrv({ get } as unknown as DataSourceSrv);

        await expect(getDataSourceInstance(settings.uid)).rejects.toBeInstanceOf(DataSourcePluginImportError);

        expect(get).not.toHaveBeenCalled();
        expect(logWarning).not.toHaveBeenCalledWith(FALLBACK_TO_LEGACY_INSTANCE_WARNING, expect.anything());
      });

      it('caches nothing, so the next call retries the import', async () => {
        const settings = ds();
        setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
        const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
        const mockImport = jest
          .fn()
          .mockRejectedValueOnce(new Error('module not found'))
          .mockResolvedValueOnce({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} });
        setDataSourcePluginImporter(mockImport);

        await expect(getDataSourceInstance(settings.uid)).rejects.toBeInstanceOf(DataSourcePluginImportError);
        expect(getCachedPlugin(settings.uid)).toBeUndefined();

        await expect(getDataSourceInstance(settings.uid)).resolves.toBe(instance);
        expect(mockImport).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('registerRuntimeDataSourceInstance', () => {
    it('makes the runtime instance available via getDataSourceInstance', async () => {
      setDataSourceInstanceSettings({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSourceInstance({ dataSource: runtime });

      const result = await getDataSourceInstance('runtime-uid');
      expect(result).toBe(runtime);
    });

    it('throws on duplicate uid', () => {
      setDataSourceInstanceSettings({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSourceInstance({ dataSource: runtime });
      const duplicate = new TestRuntime('plugin-id', 'runtime-uid');
      expect(() => registerRuntimeDataSourceInstance({ dataSource: duplicate })).toThrow(/already been registered/);
    });

    it('exposes the registered instance through the synchronous lookup', () => {
      setDataSourceInstanceSettings({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSourceInstance({ dataSource: runtime });

      expect(getRuntimePlugin('runtime-uid')).toBe(runtime);
      expect(getRuntimePlugin('unknown-uid')).toBeUndefined();
    });

    it('forgets runtime instances when the cache is reseeded', () => {
      setDataSourceInstanceSettings({}, '');
      registerRuntimeDataSourceInstance({ dataSource: new TestRuntime('plugin-id', 'runtime-uid') });

      setDataSourceInstanceSettings({}, '');

      expect(getRuntimePlugin('runtime-uid')).toBeUndefined();
      expect(() =>
        registerRuntimeDataSourceInstance({ dataSource: new TestRuntime('plugin-id', 'runtime-uid') })
      ).not.toThrow();
    });
  });

  describe('reload', () => {
    it('clears non-runtime plugin instances so they are rebuilt from fresh settings', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

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
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const MockClass = jest.fn().mockReturnValue(instance);
      const mockImport = jest.fn().mockResolvedValue({ DataSourceClass: MockClass, components: {} });
      setDataSourcePluginImporter(mockImport);

      // Prime the cache.
      await getDataSourceInstance(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(1);

      // Sync from an already-fetched payload — no network round trip.
      await syncDataSourceInstanceSettings({
        datasources: { [settings.name]: settings },
        defaultDatasource: settings.name,
      });

      // The importer must be called again because the cache was cleared.
      await getDataSourceInstance(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(2);
    });

    describe('when the cache is cleared while a load is in flight', () => {
      // Each import resolves only when the test says so, so a sync can run in between.
      function setupDeferredImports() {
        const settings = ds();
        setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

        const resolvers: Array<() => void> = [];
        const instances: DataSourceApi[] = [];
        // Untyped like the other importer mocks here: the fake plugin only has what the loader reads.
        const mockImport = jest.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
              instances.push(instance);
              resolvers.push(() => resolve({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} }));
            })
        );
        setDataSourcePluginImporter(mockImport);

        const sync = () =>
          syncDataSourceInstanceSettings({
            datasources: { [settings.name]: settings },
            defaultDatasource: settings.name,
          });
        // Let pending awaits run, so a started load reaches the importer.
        const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

        return { settings, mockImport, resolvers, instances, sync, flush };
      }

      it('still resolves the load, but does not cache the instance it built', async () => {
        const { settings, mockImport, resolvers, instances, sync, flush } = setupDeferredImports();

        const before = getDataSourceInstance(settings.uid);
        await flush();
        await sync();
        resolvers[0]();

        await expect(before).resolves.toBe(instances[0]);
        expect(getCachedPlugin(settings.uid)).toBeUndefined();

        const after = getDataSourceInstance(settings.uid);
        await flush();
        resolvers[1]();
        await expect(after).resolves.toBe(instances[1]);
        expect(mockImport).toHaveBeenCalledTimes(2);
      });

      it('does not let a later caller join the load that started before the clear', async () => {
        const { settings, mockImport, resolvers, instances, sync, flush } = setupDeferredImports();

        const before = getDataSourceInstance(settings.uid);
        await flush();
        await sync();
        const after = getDataSourceInstance(settings.uid);
        await flush();
        expect(mockImport).toHaveBeenCalledTimes(2);

        // The old load finishes last. It must not replace the instance from the new load, and it
        // hands its callers that current instance rather than the one built from old settings.
        resolvers[1]();
        await expect(after).resolves.toBe(instances[1]);
        resolvers[0]();
        await expect(before).resolves.toBe(instances[1]);

        expect(getCachedPlugin(settings.uid)).toBe(instances[1]);
        await expect(getDataSourceInstance(settings.uid)).resolves.toBe(instances[1]);
      });
    });

    it('preserves runtime plugin instances across reload', async () => {
      setDataSourceInstanceSettings({}, '');
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
      setDataSourceInstanceSettings({}, '');
      const expr = registerExpression();
      const mockImport = jest.fn();
      setDataSourcePluginImporter(mockImport);

      const result = await getDataSourceInstance('__expr__');

      expect(result).toBe(expr);
      expect(mockImport).not.toHaveBeenCalled();
    });

    it('resolves legacy id -100 and name Expression to the same singleton', async () => {
      setDataSourceInstanceSettings({}, '');
      const expr = registerExpression();
      setDataSourcePluginImporter(jest.fn());

      expect(await getDataSourceInstance('-100')).toBe(expr);
      expect(await getDataSourceInstance('Expression')).toBe(expr);
    });

    it('resolves a DataSourceRef with the expression type', async () => {
      setDataSourceInstanceSettings({}, '');
      const expr = registerExpression();
      setDataSourcePluginImporter(jest.fn());

      const result = await getDataSourceInstance({ type: '__expr__', uid: '__expr__' });
      expect(result).toBe(expr);
    });

    it('resolves a DataSourceRef with the expression uid but no type', async () => {
      setDataSourceInstanceSettings({}, '');
      const expr = registerExpression();
      const mockImport = jest.fn();
      setDataSourcePluginImporter(mockImport);

      const result = await getDataSourceInstance({ uid: '__expr__' });

      expect(result).toBe(expr);
      expect(mockImport).not.toHaveBeenCalled();
    });

    it('survives a reload (state is in expressionDs module, independent of the plugin cache)', async () => {
      setDataSourceInstanceSettings({}, '');
      const expr = registerExpression();

      jest.spyOn(require('../../services/backendSrv'), 'getBackendSrv').mockReturnValue({
        get: jest.fn().mockResolvedValue({ datasources: {}, defaultDatasource: '' }),
      });
      await reloadDataSourceInstanceSettings();

      expect(await getDataSourceInstance('__expr__')).toBe(expr);
    });

    it('throws if the singleton has not been registered', async () => {
      setDataSourceInstanceSettings({}, '');
      await expect(getDataSourceInstance('__expr__')).rejects.toThrow('Expression datasource has not been initialised');
    });
  });

  describe('legacy DataSourceSrv fallback', () => {
    it('falls back to the legacy srv and logs a warning when the new path cannot resolve the instance', async () => {
      // Empty cache so the new path throws "not found".
      setDataSourceInstanceSettings({}, '');
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
      setDataSourceInstanceSettings({}, '');
      setDataSourcePluginImporter(jest.fn());

      const get = jest.fn().mockRejectedValue(new Error('legacy not found'));
      const getInstanceSettings = jest.fn().mockReturnValue(undefined);
      setDataSourceSrv({ get, getInstanceSettings } as unknown as DataSourceSrv);

      await expect(getDataSourceInstance('unknown-uid')).rejects.toThrow(/was not found/);
      expect(logWarning).not.toHaveBeenCalled();
    });

    it('does not consult the legacy srv when the new path succeeds', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

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

    it('rejects a concurrent in-flight caller without the fallback when the load fails', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      // A deferred import so the first caller's load stays in-flight while the second arrives.
      let rejectImport: (err: Error) => void = () => {};
      const importPromise = new Promise((_, reject) => {
        rejectImport = reject;
      });
      const mockImport = jest.fn().mockReturnValue(importPromise);
      setDataSourcePluginImporter(mockImport);

      const get = jest.fn();
      setDataSourceSrv({ get } as unknown as DataSourceSrv);

      const results = Promise.allSettled([getDataSourceInstance(settings.uid), getDataSourceInstance(settings.uid)]);

      // Let both reach their await points (first awaiting the load, second awaiting in-flight).
      await new Promise((resolve) => setTimeout(resolve, 0));
      rejectImport(new Error('module not found'));

      const [first, second] = await results;
      expect(first).toMatchObject({ status: 'rejected', reason: expect.any(DataSourcePluginImportError) });
      expect(second).toMatchObject({ status: 'rejected', reason: expect.any(DataSourcePluginImportError) });
      expect(mockImport).toHaveBeenCalledTimes(1);
      expect(get).not.toHaveBeenCalled();
    });
  });
});
