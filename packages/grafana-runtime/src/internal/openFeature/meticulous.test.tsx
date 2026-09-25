import type { FeatureFlagOverride } from '@alwaysmeticulous/sdk-bundles-api';
import { LocalStorageProvider } from '@openfeature/localstorage-provider';
import { InMemoryProvider, OpenFeature, OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, renderHook, waitFor } from '@testing-library/react';

import { config } from '../../config';

import { createMeticulousProvider } from './meticulous';
import { FlagKeys, useFlagCanvasPanelPanZoom, useFlagDashboardNewLayouts } from './openfeature.gen';

const domain = 'meticulous-integration-test';
const client = OpenFeature.getClient(domain);
const getFlagOverride = jest.fn<FeatureFlagOverride, [string]>();
const recordFeatureFlag = jest.fn(() => ({ success: true }));
const local = new LocalStorageProvider({ prefix: 'meticulous-test.' });

async function install() {
  await OpenFeature.setProviderAndWait(
    domain,
    createMeticulousProvider([
      local,
      new InMemoryProvider({
        dashboardNewLayouts: { variants: { recorded: true }, defaultVariant: 'recorded', disabled: false },
        canvasPanelPanZoom: { variants: { recorded: true }, defaultVariant: 'recorded', disabled: false },
        'meticulous.test.number': { variants: { recorded: 42 }, defaultVariant: 'recorded', disabled: false },
        'grafana.mtFallback': {
          variants: { recorded: { enabled: true } },
          defaultVariant: 'recorded',
          disabled: false,
        },
      }),
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
  local.setFlags({ dashboardNewLayouts: !value });
  getFlagOverride.mockReturnValue({ overridden: true, value });

  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, !value)).toBe(value);
  expect(getFlagOverride).toHaveBeenCalledWith('dashboardNewLayouts');
  expect(recordFeatureFlag.mock.calls).toEqual([['dashboardNewLayouts', value]]);
});

it('reports localStorage, recorded and default values when no override exists', () => {
  local.setFlags({ dashboardNewLayouts: false });
  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, true)).toBe(false);
  local.clearFlags();
  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, false)).toBe(true);
  expect(client.getBooleanValue(FlagKeys.CanvasPanelNesting, false)).toBe(false);
  expect(recordFeatureFlag.mock.calls).toEqual([
    ['dashboardNewLayouts', false],
    ['dashboardNewLayouts', true],
    ['canvasPanelNesting', false],
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
  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, false)).toBe(true);
  expect(recordFeatureFlag).toHaveBeenCalledWith('dashboardNewLayouts', true);
  expect(warn).toHaveBeenCalledWith('Ignoring Meticulous override for "dashboardNewLayouts": expected boolean');
});

it('leaves number and object evaluations to the existing providers without reporting them', () => {
  getFlagOverride.mockReturnValue({ overridden: true, value: false });
  // @ts-expect-error Test a numeric flag outside the generated registry.
  expect(client.getNumberValue('meticulous.test.number', 0)).toBe(42);
  expect(client.getObjectValue(FlagKeys.GrafanaMtFallback, {})).toEqual({ enabled: true });
  expect(getFlagOverride).not.toHaveBeenCalled();
  expect(recordFeatureFlag).not.toHaveBeenCalled();
});

it('reports the caller default when the existing provider returns a type error', () => {
  local.setFlags({ dashboardNewLayouts: 'not a boolean' });
  const result = client.getBooleanDetails(FlagKeys.DashboardNewLayouts, false);
  expect(result).toMatchObject({ value: false, reason: 'ERROR', errorCode: 'GENERAL' });
  expect(recordFeatureFlag.mock.calls).toEqual([['dashboardNewLayouts', false]]);
});

it.each([undefined, {}, { context: {} }])('preserves recorded values with unavailable recorder APIs: %j', (api) => {
  window.Meticulous = api;
  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, false)).toBe(true);
});

it('uses recorder APIs that become available after provider initialization', () => {
  delete window.Meticulous;
  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, false)).toBe(true);
  window.Meticulous = { context: { getFlagOverride, recordFeatureFlag } };
  getFlagOverride.mockReturnValue({ overridden: true, value: false });
  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, true)).toBe(false);
  expect(recordFeatureFlag).toHaveBeenCalledWith('dashboardNewLayouts', false);
});

it('preserves flag resolution when either recorder API throws', () => {
  jest.spyOn(console, 'warn').mockImplementation();
  getFlagOverride.mockImplementation(() => {
    throw new Error('Recorder unavailable');
  });
  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, false)).toBe(true);
  expect(recordFeatureFlag).toHaveBeenCalledWith('dashboardNewLayouts', true);
  recordFeatureFlag.mockImplementationOnce(() => {
    throw new Error('Reporting unavailable');
  });
  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, false)).toBe(true);
});

it('does not duplicate reporting after replacing the provider', async () => {
  await install();
  expect(client.getBooleanValue(FlagKeys.DashboardNewLayouts, false)).toBe(true);
  expect(recordFeatureFlag.mock.calls).toEqual([['dashboardNewLayouts', true]]);
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
    const { result } = renderHook(
      () => ({ canvas: useFlagCanvasPanelPanZoom(), layouts: useFlagDashboardNewLayouts() }),
      { wrapper: ({ children }) => <OpenFeatureProvider client={client}>{children}</OpenFeatureProvider> }
    );
    expect(result.current).toEqual({ canvas: true, layouts: true });
    act(() => local.setFlags({ canvasPanelPanZoom: false, dashboardNewLayouts: false }));
    await waitFor(() => expect(result.current).toEqual({ canvas: false, layouts: false }));
    expect(recordFeatureFlag).toHaveBeenCalledWith('canvasPanelPanZoom', false);
    expect(recordFeatureFlag).toHaveBeenCalledWith('dashboardNewLayouts', false);
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
