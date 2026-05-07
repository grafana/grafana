import { setTestFlags } from '@grafana/test-utils/unstable';

import { invalidateCachedPromisesCache } from '../../utils/getCachedPromise';
import { getLogger, setLogger } from '../logging/registry';

import {
  getPluginMetaFromCache,
  initPluginMetas,
  installPluginMeta,
  refetchPluginMeta,
  refetchPluginMetas,
  uninstallPluginMeta,
} from './plugins';
import { v0alpha1Meta } from './test-fixtures/v0alpha1Response';

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  invalidateCachedPromisesCache();
  // can't use mockLogger here because that would cause a circular dependency between @grafana/runtime and @grafana/test-utils
  setLogger('grafana/runtime.utils.getCachedPromise', {
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning: jest.fn(),
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('when useMTPlugins flag is enabled', () => {
  beforeAll(() => {
    setTestFlags({ useMTPlugins: true });
  });

  afterAll(() => {
    setTestFlags({});
  });

  describe('and cache is not initialized', () => {
    it('initPluginMetas should call loadPluginMetas and return correct result if response is ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [v0alpha1Meta] }),
      });

      const response = await initPluginMetas();

      expect(response.items).toHaveLength(1);
      expect(response.items[0]).toBe(v0alpha1Meta);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
    });
  });

  describe('and cache is initialized', () => {
    it('initPluginMetas should call loadPluginMetas once', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [v0alpha1Meta] }),
      });

      await initPluginMetas();
      await initPluginMetas();
      await initPluginMetas();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
    });

    it('initPluginMetas should call loadPluginMetas again if refetchPluginMetas is called', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [v0alpha1Meta] }),
      });

      await initPluginMetas();
      await refetchPluginMetas();
      await initPluginMetas();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
    });
  });

  describe('and errors occur', () => {
    it('initPluginMetas should log when fetch fails', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error',
          status: 500,
        })
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ items: [v0alpha1Meta] }),
        });

      await initPluginMetas();
      await initPluginMetas();
      await initPluginMetas();

      expect(global.fetch).toHaveBeenCalledTimes(2); // first + second (because first throws), third is cached
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
      expect(getLogger('grafana/runtime.utils.getCachedPromise').logError).toHaveBeenCalledTimes(1);
      expect(getLogger('grafana/runtime.utils.getCachedPromise').logError).toHaveBeenCalledWith(
        new Error(`getCachedPromise: Something failed while resolving a cached promise`),

        {
          message: 'Failed to load plugin metas 500:Internal Server Error',
          stack: expect.any(String),
          key: expect.stringMatching(/^loadPluginMetas:-?\d+$/),
        }
      );
    });

    it('initPluginMetas should log when fetch rejects', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ items: [v0alpha1Meta] }),
        });

      await initPluginMetas();
      await initPluginMetas();
      await initPluginMetas();

      expect(global.fetch).toHaveBeenCalledTimes(2); // first + second (because first throws), third is cached
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
      expect(getLogger('grafana/runtime.utils.getCachedPromise').logError).toHaveBeenCalledTimes(1);
      expect(getLogger('grafana/runtime.utils.getCachedPromise').logError).toHaveBeenCalledWith(
        new Error(`getCachedPromise: Something failed while resolving a cached promise`),

        {
          message: 'Network Error',
          stack: expect.any(String),
          key: expect.stringMatching(/^loadPluginMetas:-?\d+$/),
        }
      );
    });
  });

  describe('installPluginMeta', () => {
    it('should post correct body, headers and method to the correct url', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await installPluginMeta('myorg-test-panel', '1.5.0');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/plugins', {
        body: JSON.stringify({
          apiVersion: 'plugins.grafana.app/v0alpha1',
          kind: 'Plugin',
          metadata: {
            name: 'myorg-test-panel',
            namespace: 'default',
          },
          spec: {
            id: 'myorg-test-panel',
            version: '1.5.0',
          },
          status: {},
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
    });

    it('should throw an error if response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        status: 500,
      });

      await expect(installPluginMeta('myorg-test-panel', '1.5.0')).rejects.toThrow(
        'Failed to install plugin myorg-test-panel 500:Internal Server Error'
      );
    });

    it('should throw an error if fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network Error'));

      await expect(installPluginMeta('myorg-test-panel', '1.5.0')).rejects.toThrow('Network Error');
    });
  });

  describe('uninstallPluginMeta', () => {
    it('should post correct body, headers and method to the correct url', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await uninstallPluginMeta('myorg-test-panel');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'apis/plugins.grafana.app/v0alpha1/namespaces/default/plugins/myorg-test-panel',
        { method: 'DELETE' }
      );
    });

    it('should throw an error if response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        status: 500,
      });

      await expect(uninstallPluginMeta('myorg-test-panel')).rejects.toThrow(
        'Failed to uninstall plugin myorg-test-panel 500:Internal Server Error'
      );
    });

    it('should throw an error if fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network Error'));

      await expect(uninstallPluginMeta('myorg-test-panel')).rejects.toThrow('Network Error');
    });
  });

  describe('getPluginMetaFromCache', () => {
    it('should get meta from cache if that exists', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [v0alpha1Meta] }),
      });

      await initPluginMetas();
      const response = await getPluginMetaFromCache(v0alpha1Meta.spec.pluginJson.id);

      expect(response).toStrictEqual(v0alpha1Meta);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
    });

    it('should not get meta from cache if that does not exist', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [v0alpha1Meta] }),
      });

      const response = await getPluginMetaFromCache(v0alpha1Meta.spec.pluginJson.id);

      expect(response).toStrictEqual(v0alpha1Meta);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
    });

    it('should return null if plugin id does not exist', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [v0alpha1Meta] }),
      });

      const response = await getPluginMetaFromCache('grafana-clock-panel');

      expect(response).toStrictEqual(null);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
    });
  });

  describe('refetchPluginMeta', () => {
    it('should always refetch meta even if cache exists', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [v0alpha1Meta] }),
      });

      await initPluginMetas();
      const response = await refetchPluginMeta(v0alpha1Meta.spec.pluginJson.id);

      expect(response).toStrictEqual(v0alpha1Meta);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
    });

    it('should return null if plugin id does not exist', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [v0alpha1Meta] }),
      });

      const response = await refetchPluginMeta('grafana-clock-panel');

      expect(response).toStrictEqual(null);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
    });
  });
});

describe('when useMTPlugins flag is disabled', () => {
  beforeAll(() => {
    setTestFlags({ useMTPlugins: false });
  });

  afterAll(() => {
    setTestFlags({});
  });

  describe('and cache is not initialized', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('initPluginMetas should call loadPluginMetas and return correct result if response is ok', async () => {
      const response = await initPluginMetas();

      expect(response.items).toHaveLength(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('and cache is initialized', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('initPluginMetas should return cache', async () => {
      const original = await initPluginMetas();
      const cached = await initPluginMetas();

      expect(original).toBe(cached);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('installPluginMeta', () => {
    it('should not call fetch when useMTPlugins is disabled', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await installPluginMeta('myorg-test-panel', '1.5.0');

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('uninstallPluginMeta', () => {
    it('should not call fetch when useMTPlugins is disabled', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await uninstallPluginMeta('myorg-test-panel');

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getPluginMetaFromCache', () => {
    it('should always return null', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await getPluginMetaFromCache(v0alpha1Meta.spec.pluginJson.id);

      expect(response).toStrictEqual(null);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('refetchPluginMeta', () => {
    it('should always return null', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await refetchPluginMeta(v0alpha1Meta.spec.pluginJson.id);

      expect(response).toStrictEqual(null);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
