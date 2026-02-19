import { setTestFlags } from '@grafana/test-utils/unstable';

import { invalidateCache, setLogger } from '../../utils/getCachedPromise';
import { type MonitoringLogger } from '../../utils/logging';

import { initPluginMetas, refetchPluginMetas } from './plugins';
import { v0alpha1Meta } from './test-fixtures/v0alpha1Response';

const originalFetch = global.fetch;
let loggerMock: MonitoringLogger;

beforeEach(() => {
  jest.clearAllMocks();
  invalidateCache();
  loggerMock = {
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning: jest.fn(),
  };
  setLogger(loggerMock);
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
      expect(loggerMock.logError).toHaveBeenCalledTimes(1);
      expect(loggerMock.logError).toHaveBeenCalledWith(new Error(`Something failed while resolving a cached promise`), {
        message: 'Failed to load plugin metas 500:Internal Server Error',
        stack: expect.any(String),
        key: 'loadPluginMetas',
      });
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
      expect(loggerMock.logError).toHaveBeenCalledTimes(1);
      expect(loggerMock.logError).toHaveBeenCalledWith(new Error(`Something failed while resolving a cached promise`), {
        message: 'Network Error',
        stack: expect.any(String),
        key: 'loadPluginMetas',
      });
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
});
