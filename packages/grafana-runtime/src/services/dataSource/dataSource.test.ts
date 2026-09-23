import {
  DataSourceApi,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type TestDataSourceResponse,
} from '@grafana/data';

import { TracedError } from '../../utils/TracedError';
import { RuntimeDataSource } from '../RuntimeDataSource';
import { type DataSourceSrv, setDataSourceSrv } from '../dataSourceSrv';
import { setLogger } from '../logging/registry';
import * as datasourceMetas from '../pluginMeta/datasources';
import { setDatasourcePluginMetas } from '../pluginMeta/datasources';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import { FALLBACK_TO_LEGACY_INSTANCE_WARNING, PLUGIN_CACHE_UID_MISMATCH_WARNING } from './constants';
import {
  _resetForTests as resetPlugin,
  getDataSourceInstance,
  registerRuntimeDataSourceInstance,
  setDataSourcePluginImporter,
} from './dataSource';
import { setExpressionDataSourceInstance } from './expressionDs';
import { _resetForTests as resetPluginCache } from './pluginCache';
import {
  getDataSourceInstanceSettings,
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
  setDatasourcePluginMetas({ 'test-db': ds().meta });
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

    it('throws when the plugin import fails', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      setDataSourcePluginImporter(jest.fn().mockRejectedValue(new Error('module not found')));

      await expect(getDataSourceInstance(settings.uid)).rejects.toThrow(/module not found/);
    });

    it('logs a TracedError that preserves the original stack and does not sanitize the rethrow', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);
      const importError = new Error('module not found');
      setDataSourcePluginImporter(jest.fn().mockRejectedValue(importError));

      await expect(getDataSourceInstance(settings.uid)).rejects.toBe(importError);

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

      it.each(['[[ds]]', { uid: '[[ds]]' }])(
        'constructs and caches the concrete instance for bracket ref %p',
        async (ref) => {
          const settings = ds();
          setDataSourceInstanceSettings({ [settings.name]: settings });
          const replace = jest.fn().mockReturnValue('uid-alpha');
          setTemplateSrv({ getVariables: () => [], replace } as unknown as TemplateSrv);
          const importer = jest.fn().mockResolvedValue({ DataSourceClass: CapturingDataSource, components: {} });
          setDataSourcePluginImporter(importer);
          const scopedVars = { ds: { text: 'Alpha', value: 'uid-alpha' } };

          const result = await getDataSourceInstance(ref, scopedVars);

          expect(result.getRef()).toEqual({ type: 'test-db', uid: 'uid-alpha' });
          expect(result.name).toBe('Alpha');
          expect(await getDataSourceInstance('uid-alpha')).toBe(result);
          expect(importer).toHaveBeenCalledTimes(1);
          expect(replace).toHaveBeenCalledWith('[[ds]]', scopedVars, expect.any(Function));
          expect(logWarning).not.toHaveBeenCalled();
        }
      );

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

    it('falls back to settings.meta when the plugin metadata cache misses', async () => {
      const settings = ds();
      setDatasourcePluginMetas({ unrelated: { ...settings.meta, id: 'unrelated' } });
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

      const mockImport = jest.fn().mockResolvedValue({
        DataSourceClass: jest.fn().mockReturnValue(Object.create(DataSourceApi.prototype)),
        components: {},
      });
      setDataSourcePluginImporter(mockImport);

      await getDataSourceInstance(settings.uid);

      const cachedSettings = await getDataSourceInstanceSettings(settings.uid);
      expect(mockImport.mock.calls[0][0]).toBe(cachedSettings?.meta);
    });

    it.each([
      { type: 'test-db', name: 'Alpha', pluginId: 'test-db' },
      { type: 'datasource', name: '-- Grafana --', pluginId: 'grafana' },
      { type: 'loki-alias', name: 'Aliased Loki', pluginId: 'loki' },
    ])(
      'imports cached plugin metadata for $type and patches legacy plugins consistently',
      async ({ type, name, pluginId }) => {
        const settings = ds({ type, name });
        const meta = { ...settings.meta, id: pluginId, module: 'plugin/module', aliasIDs: ['loki-alias'] };
        setDatasourcePluginMetas({ [pluginId]: meta });
        setDataSourceInstanceSettings({ [name]: settings });
        const instance = {};
        const DataSourceClass = jest.fn().mockReturnValue(instance);
        const importer = jest.fn().mockResolvedValue({ DataSourceClass, components: {} });
        setDataSourcePluginImporter(importer);

        const result = await getDataSourceInstance(settings.uid);

        expect(result).toBe(instance);
        expect(importer).toHaveBeenCalledWith(meta);
        expect(DataSourceClass).toHaveBeenCalledWith(settings);
        expect(result.meta).toEqual(meta);
        expect(result.type).toBe(type === 'datasource' ? 'grafana' : type);
        expect(result.getRef()).toEqual({ uid: 'uid-alpha', type: type === 'datasource' ? 'grafana' : type });
      }
    );

    it('shares metadata resolution for concurrent loads of one uid and reloads after invalidation', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings });
      const resolveMeta = jest.spyOn(datasourceMetas, 'getDatasourcePluginMeta');
      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const importer = jest
        .fn()
        .mockResolvedValue({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} });
      setDataSourcePluginImporter(importer);

      try {
        const results = await Promise.all([getDataSourceInstance(settings.uid), getDataSourceInstance(settings.uid)]);
        expect(results).toEqual([instance, instance]);
        expect(await getDataSourceInstance(settings.uid)).toBe(instance);
        expect(resolveMeta).toHaveBeenCalledTimes(1);
        expect(importer).toHaveBeenCalledTimes(1);

        syncDataSourceInstanceSettings({
          datasources: { [settings.name]: settings },
          defaultDatasource: settings.name,
        });
        expect(await getDataSourceInstance(settings.uid)).toBe(instance);
        expect(resolveMeta).toHaveBeenCalledTimes(2);
      } finally {
        resolveMeta.mockRestore();
      }
    });

    it('retries a failed import using refreshed plugin metadata', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings });
      const instance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      const importer = jest
        .fn()
        .mockRejectedValueOnce(new Error('unavailable'))
        .mockResolvedValue({
          DataSourceClass: jest.fn().mockReturnValue(instance),
          components: {},
        });
      setDataSourcePluginImporter(importer);

      await expect(getDataSourceInstance(settings.uid)).rejects.toThrow('unavailable');
      const refreshedMeta = { ...settings.meta, module: 'refreshed/module' };
      setDatasourcePluginMetas({ 'test-db': refreshedMeta });

      expect(await getDataSourceInstance(settings.uid)).toBe(instance);
      expect(importer).toHaveBeenLastCalledWith(refreshedMeta);
      expect(importer).toHaveBeenCalledTimes(2);
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
      syncDataSourceInstanceSettings({
        datasources: { [settings.name]: settings },
        defaultDatasource: settings.name,
      });

      // The importer must be called again because the cache was cleared.
      await getDataSourceInstance(settings.uid);
      expect(mockImport).toHaveBeenCalledTimes(2);
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
      expect(logWarning).toHaveBeenCalledWith(FALLBACK_TO_LEGACY_INSTANCE_WARNING, {
        ref: 'unknown-uid',
        originMessage: 'Datasource unknown-uid was not found',
      });
    });

    it.each([
      { kind: 'Error', error: new Error('module not found') },
      { kind: 'string', error: 'module not found' },
      { kind: 'message object', error: { message: 'module not found' } },
    ])('records the original $kind rejection when legacy resolution succeeds', async ({ error }) => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings });
      setDataSourcePluginImporter(jest.fn().mockRejectedValue(error));
      const legacyInstance = Object.create(DataSourceApi.prototype) as DataSourceApi;
      setDataSourceSrv({ get: jest.fn().mockResolvedValue(legacyInstance) } as unknown as DataSourceSrv);

      await expect(getDataSourceInstance(settings.uid)).resolves.toBe(legacyInstance);
      expect(logWarning).toHaveBeenCalledWith(FALLBACK_TO_LEGACY_INSTANCE_WARNING, {
        ref: settings.uid,
        originMessage: 'module not found',
      });
    });

    it('preserves the import error when legacy resolution also fails', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings });
      const error = new Error('module not found');
      setDataSourcePluginImporter(jest.fn().mockRejectedValue(error));
      setDataSourceSrv({ get: jest.fn().mockRejectedValue(new Error('legacy failed')) } as unknown as DataSourceSrv);

      await expect(getDataSourceInstance(settings.uid)).rejects.toBe(error);
      expect(logWarning).not.toHaveBeenCalled();
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

    it('routes a concurrent in-flight caller through the fallback when the load rejects', async () => {
      const settings = ds();
      setDataSourceInstanceSettings({ [settings.name]: settings }, settings.name);

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
