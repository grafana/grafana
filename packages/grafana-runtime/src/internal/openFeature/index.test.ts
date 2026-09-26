import { FlagKeys } from './openfeature.gen';

import type * as Runtime from './index';

let runtime: typeof Runtime;

beforeEach(async () => {
  // OFREP providers cannot be reused after shutdown; each test models a fresh page load.
  jest.resetModules();
  runtime = await import('./index');
  jest.spyOn(window, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ flags: [{ key: 'dashboardNewLayouts', value: true, reason: 'STATIC' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
});

afterEach(async () => {
  delete window.Meticulous;
  runtime.getLocalStorageProvider().clearFlags();
  const { OpenFeature } = await import('@openfeature/react-sdk');
  await OpenFeature.clearProviders();
  OpenFeature.clearHandlers();
  jest.restoreAllMocks();
  jest.dontMock('./meticulous');
});

it('does not load the adapter when the Meticulous global is absent', async () => {
  delete window.Meticulous;
  const loadAdapter = jest.fn();
  jest.doMock('./meticulous', () => {
    loadAdapter();
    throw new Error('Adapter must not load');
  });

  await runtime.initOpenFeature();

  expect(runtime.getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNewLayouts, false)).toBe(true);
  expect(loadAdapter).not.toHaveBeenCalled();
});

it('awaits the adapter when the Meticulous global is present and applies overrides ahead of localStorage and OFREP', async () => {
  const recordFeatureFlag = jest.fn(() => ({ success: true }));
  window.Meticulous = {
    context: { getFlagOverride: () => ({ overridden: true, value: false }), recordFeatureFlag },
  };
  runtime.getLocalStorageProvider().setFlags({ dashboardNewLayouts: true });

  await runtime.initOpenFeature();

  expect(runtime.getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNewLayouts, true)).toBe(false);
  expect(recordFeatureFlag.mock.calls).toEqual([['dashboardNewLayouts', false]]);
});

it('falls back to OFREP when the enabled adapter chunk cannot load', async () => {
  window.Meticulous = {};
  const error = new Error('Chunk unavailable');
  jest.doMock('./meticulous', () => {
    throw error;
  });
  const log = jest.spyOn(console, 'error').mockImplementation();
  await runtime.initOpenFeature();
  expect(runtime.getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNewLayouts, false)).toBe(true);
  expect(log).toHaveBeenCalledWith('Failed to load Meticulous OpenFeature integration', error);
});
