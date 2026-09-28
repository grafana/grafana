import type { FeatureFlagOverride } from '@alwaysmeticulous/sdk-bundles-api';
import { LocalStorageProvider } from '@openfeature/localstorage-provider';
import { InMemoryProvider, MultiProvider, OpenFeature, OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, renderHook, waitFor } from '@testing-library/react';

import { config } from '../../config';

import { MeticulousProvider, meticulousReportingHook } from './meticulous';
import * as generatedFlags from './openfeature.gen';

const [firstFlagName, secondFlagName, missingFlagName] = Object.keys(generatedFlags.FlagKeys) as Array<
  keyof typeof generatedFlags.FlagKeys
>;
const providedFlag = generatedFlags.FlagKeys[firstFlagName];
const secondProvidedFlag = generatedFlags.FlagKeys[secondFlagName];
const missingFlag = generatedFlags.FlagKeys[missingFlagName];
const useFirstFlag = generatedFlags[`useFlag${firstFlagName}`];
const useSecondFlag = generatedFlags[`useFlag${secondFlagName}`];

const domain = 'meticulous-integration-test';
const client = OpenFeature.getClient(domain);
client.addHooks(meticulousReportingHook);
const getFlagOverride = jest.fn<FeatureFlagOverride, [string]>();
const recordFeatureFlag = jest.fn(() => ({ success: true }));
const local = new LocalStorageProvider({ prefix: 'meticulous-test.' });

async function install() {
  await OpenFeature.setProviderAndWait(
    domain,
    new MultiProvider([
      { provider: new MeticulousProvider() },
      { provider: local },
      {
        provider: new InMemoryProvider({
          [providedFlag]: { variants: { recorded: true }, defaultVariant: 'recorded', disabled: false },
          [secondProvidedFlag]: { variants: { recorded: true }, defaultVariant: 'recorded', disabled: false },
          'meticulous.test.number': { variants: { recorded: 42 }, defaultVariant: 'recorded', disabled: false },
          'meticulous.test.object': {
            variants: { recorded: { enabled: true } },
            defaultVariant: 'recorded',
            disabled: false,
          },
        }),
      },
    ])
  );
}

beforeEach(async () => {
  getFlagOverride.mockReset().mockReturnValue({ overridden: false });
  recordFeatureFlag.mockClear();
  window.Meticulous = { context: { getFlagOverride, recordFeatureFlag } };
  await install();
});

afterEach(async () => {
  local.clearFlags();
  delete window.Meticulous;
  await OpenFeature.clearProviders();
  jest.restoreAllMocks();
});

it.each([true, false])('uses and reports override %s over localStorage and recorded flags', (value) => {
  local.setFlags({ [providedFlag]: !value });
  getFlagOverride.mockReturnValue({ overridden: true, value });

  expect(client.getBooleanValue(providedFlag, !value)).toBe(value);
  expect(getFlagOverride).toHaveBeenCalledWith(providedFlag);
  expect(recordFeatureFlag.mock.calls).toEqual([[providedFlag, value]]);
});

it('reports localStorage, recorded and default values when no override exists', () => {
  local.setFlags({ [providedFlag]: false });
  expect(client.getBooleanValue(providedFlag, true)).toBe(false);
  local.clearFlags();
  expect(client.getBooleanValue(providedFlag, false)).toBe(true);
  expect(client.getBooleanValue(missingFlag, false)).toBe(false);
  expect(recordFeatureFlag.mock.calls).toEqual([
    [providedFlag, false],
    [providedFlag, true],
    [missingFlag, false],
  ]);
});

it.each(['', 'treatment'])('preserves string override %j and dotted flag keys', (value) => {
  getFlagOverride.mockReturnValue({ overridden: true, value });
  // No string flags are currently generated, but the adapter supports the SDK's string evaluations.
  // @ts-expect-error Test a string flag outside the generated registry.
  expect(client.getStringValue('meticulous.test.variant', 'control')).toBe(value);
  expect(recordFeatureFlag).toHaveBeenCalledWith('meticulous.test.variant', value);
});

it('ignores incorrectly typed overrides instead of coercing them', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation();
  getFlagOverride.mockReturnValue({ overridden: true, value: 'false' });
  expect(client.getBooleanValue(providedFlag, false)).toBe(true);
  expect(recordFeatureFlag).toHaveBeenCalledWith(providedFlag, true);
  expect(warn).toHaveBeenCalledWith(`Ignoring Meticulous override for "${providedFlag}": expected boolean`);
});

it('leaves number and object evaluations to the existing providers without reporting them', () => {
  getFlagOverride.mockReturnValue({ overridden: true, value: false });
  // @ts-expect-error Test a numeric flag outside the generated registry.
  expect(client.getNumberValue('meticulous.test.number', 0)).toBe(42);
  // @ts-expect-error Test an object flag outside the generated registry.
  expect(client.getObjectValue('meticulous.test.object', {})).toEqual({ enabled: true });
  expect(getFlagOverride).not.toHaveBeenCalled();
  expect(recordFeatureFlag).not.toHaveBeenCalled();
});

it('reports the caller default when the existing provider returns a type error', () => {
  local.setFlags({ [providedFlag]: 'not a boolean' });
  const result = client.getBooleanDetails(providedFlag, false);
  expect(result).toMatchObject({ value: false, reason: 'ERROR', errorCode: 'GENERAL' });
  expect(recordFeatureFlag.mock.calls).toEqual([[providedFlag, false]]);
});

it.each([undefined, {}, { context: {} }])('preserves recorded values with unavailable recorder APIs: %j', (api) => {
  window.Meticulous = api;
  expect(client.getBooleanValue(providedFlag, false)).toBe(true);
});

it('uses recorder APIs that become available after provider initialization', () => {
  delete window.Meticulous;
  expect(client.getBooleanValue(providedFlag, false)).toBe(true);
  window.Meticulous = { context: { getFlagOverride, recordFeatureFlag } };
  getFlagOverride.mockReturnValue({ overridden: true, value: false });
  expect(client.getBooleanValue(providedFlag, true)).toBe(false);
  expect(recordFeatureFlag).toHaveBeenCalledWith(providedFlag, false);
});

it('preserves flag resolution when either recorder API throws', () => {
  jest.spyOn(console, 'warn').mockImplementation();
  getFlagOverride.mockImplementation(() => {
    throw new Error('Recorder unavailable');
  });
  expect(client.getBooleanValue(providedFlag, false)).toBe(true);
  expect(recordFeatureFlag).toHaveBeenCalledWith(providedFlag, true);
  recordFeatureFlag.mockImplementationOnce(() => {
    throw new Error('Reporting unavailable');
  });
  expect(client.getBooleanValue(providedFlag, false)).toBe(true);
});

it('does not duplicate reporting after replacing the provider', async () => {
  await install();
  expect(client.getBooleanValue(providedFlag, false)).toBe(true);
  expect(recordFeatureFlag.mock.calls).toEqual([[providedFlag, true]]);
});

it('updates generated hooks through provider events without accessing legacy toggle maps', async () => {
  const legacy = Object.getOwnPropertyDescriptor(config, 'featureToggles');
  const bootdata = Object.getOwnPropertyDescriptor(window, 'grafanaBootData');
  const rejectLegacy = () => {
    throw new Error('Legacy feature toggles must not be accessed');
  };
  Object.defineProperty(config, 'featureToggles', { configurable: true, get: rejectLegacy });
  Object.defineProperty(window, 'grafanaBootData', { configurable: true, get: rejectLegacy });
  try {
    const { result } = renderHook(() => ({ first: useFirstFlag(), second: useSecondFlag() }), {
      wrapper: ({ children }) => <OpenFeatureProvider client={client}>{children}</OpenFeatureProvider>,
    });
    expect(result.current).toEqual({ first: true, second: true });
    act(() => local.setFlags({ [secondProvidedFlag]: false, [providedFlag]: false }));
    await waitFor(() => expect(result.current).toEqual({ first: false, second: false }));
    expect(recordFeatureFlag).toHaveBeenCalledWith(secondProvidedFlag, false);
    expect(recordFeatureFlag).toHaveBeenCalledWith(providedFlag, false);
  } finally {
    if (legacy) {
      Object.defineProperty(config, 'featureToggles', legacy);
    }
    if (bootdata) {
      Object.defineProperty(window, 'grafanaBootData', bootdata);
    } else {
      Reflect.deleteProperty(window, 'grafanaBootData');
    }
  }
});
