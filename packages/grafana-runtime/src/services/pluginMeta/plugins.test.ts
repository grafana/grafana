import { config } from '../../config';

import { clearCache, initPluginMetas } from './plugins';
import { v0alpha1Meta } from './test-fixtures/v0alpha1Response';

describe('when useMTPlugins toggle is enabled and cache is not initialized', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    clearCache();
    config.featureToggles.useMTPlugins = true;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initPluginMetas should call loadPluginMetas and return correct result if response is ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [v0alpha1Meta] }),
    });

    const response = await initPluginMetas();

    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toEqual(v0alpha1Meta);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
  });

  it('initPluginMetas should call loadPluginMetas and return correct result if response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not found',
    });

    await expect(initPluginMetas()).rejects.toThrow(new Error(`Failed to load plugin metas 404:Not found`));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/apis/plugins.grafana.app/v0alpha1/namespaces/default/metas');
  });
});

describe('when useMTPlugins toggle is enabled and cache is initialized', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    clearCache();
    config.featureToggles.useMTPlugins = true;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initPluginMetas should return cache', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [v0alpha1Meta] }),
    });

    const original = await initPluginMetas();
    const cached = await initPluginMetas();

    expect(original).toEqual(cached);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('initPluginMetas should return inflight promise', async () => {
    jest.useFakeTimers();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [v0alpha1Meta] }),
    });

    const original = initPluginMetas();
    const cached = initPluginMetas();
    await jest.runAllTimersAsync();

    expect(original).toEqual(cached);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('when useMTPlugins toggle is disabled and cache is not initialized', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    clearCache();
    global.fetch = jest.fn();
    config.featureToggles.useMTPlugins = false;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initPluginMetas should call loadPluginMetas and return correct result if response is ok', async () => {
    const response = await initPluginMetas();

    expect(response.items).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('when useMTPlugins toggle is disabled and cache is initialized', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    clearCache();
    global.fetch = jest.fn();
    config.featureToggles.useMTPlugins = false;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initPluginMetas should return cache', async () => {
    const original = await initPluginMetas();
    const cached = await initPluginMetas();

    expect(original).toEqual(cached);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('initPluginMetas should return inflight promise', async () => {
    jest.useFakeTimers();

    const original = initPluginMetas();
    const cached = initPluginMetas();
    await jest.runAllTimersAsync();

    expect(original).toEqual(cached);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
