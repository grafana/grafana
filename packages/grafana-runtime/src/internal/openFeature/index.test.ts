import { FlagKeys } from './openfeature.gen';

import type * as Runtime from './index';

const [providedFlag, missingFlag] = Object.values(FlagKeys);

let runtime: typeof Runtime;

beforeEach(async () => {
  // OFREP providers cannot be reused after shutdown; each test models a fresh page load.
  jest.resetModules();
  runtime = await import('./index');
  jest.spyOn(window, 'fetch').mockImplementation(
    async () =>
      new Response(JSON.stringify({ flags: [{ key: providedFlag, value: true, reason: 'STATIC' }] }), {
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

  expect(runtime.getFeatureFlagClient().getBooleanValue(providedFlag, false)).toBe(true);
  expect(loadAdapter).not.toHaveBeenCalled();
});

it('awaits the adapter when the Meticulous global is present and applies overrides ahead of localStorage and OFREP', async () => {
  const recordFeatureFlag = jest.fn(() => ({ success: true }));
  window.Meticulous = {
    context: { getFlagOverride: () => ({ overridden: true, value: false }), recordFeatureFlag },
  };
  runtime.getLocalStorageProvider().setFlags({ [providedFlag]: true });

  await runtime.initOpenFeature();

  expect(runtime.getFeatureFlagClient().getBooleanValue(providedFlag, true)).toBe(false);
  expect(recordFeatureFlag.mock.calls).toEqual([[providedFlag, false]]);
});

it('falls back to OFREP when the enabled adapter chunk cannot load', async () => {
  window.Meticulous = {};
  const error = new Error('Chunk unavailable');
  jest.doMock('./meticulous', () => {
    throw error;
  });
  const log = jest.spyOn(console, 'error').mockImplementation();
  await runtime.initOpenFeature();
  expect(runtime.getFeatureFlagClient().getBooleanValue(providedFlag, false)).toBe(true);
  expect(log).toHaveBeenCalledWith('Failed to load Meticulous OpenFeature integration', error);
});

it('reports final fallback values once per evaluation through the shared core client', async () => {
  const recordFeatureFlag = jest.fn(() => ({ success: true }));
  window.Meticulous = {
    context: { getFlagOverride: () => ({ overridden: false }), recordFeatureFlag },
  };
  const client = runtime.getFeatureFlagClient();
  await runtime.initOpenFeature();
  // Keep the OFREP transport open while exercising repeated hook registration.
  jest.spyOn(runtime.getOFREPWebProvider(), 'onClose').mockResolvedValue();
  await runtime.initOpenFeature();

  runtime.getLocalStorageProvider().setFlags({ [providedFlag]: false });
  expect(client.getBooleanValue(providedFlag, true)).toBe(false);
  runtime.getLocalStorageProvider().clearFlags();
  expect(runtime.getFeatureFlagClient().getBooleanValue(providedFlag, false)).toBe(true);
  expect(client.getBooleanValue(missingFlag, false)).toBe(false);
  runtime.getLocalStorageProvider().setFlags({ [providedFlag]: 'invalid' });
  expect(client.getBooleanValue(providedFlag, false)).toBe(false);
  expect(recordFeatureFlag.mock.calls).toEqual([
    [providedFlag, false],
    [providedFlag, true],
    [missingFlag, false],
    [providedFlag, false],
  ]);
});

it('does not report evaluations from plugin domains', async () => {
  const recordFeatureFlag = jest.fn(() => ({ success: true }));
  window.Meticulous = { context: { recordFeatureFlag } };
  await runtime.initOpenFeature();
  const { InMemoryProvider, OpenFeature } = await import('@openfeature/react-sdk');
  await OpenFeature.setProviderAndWait(
    'plugin-domain',
    new InMemoryProvider({
      [providedFlag]: { variants: { enabled: true }, defaultVariant: 'enabled', disabled: false },
    })
  );

  expect(OpenFeature.getClient('plugin-domain').getBooleanValue(providedFlag, false)).toBe(true);
  expect(recordFeatureFlag).not.toHaveBeenCalled();
});
