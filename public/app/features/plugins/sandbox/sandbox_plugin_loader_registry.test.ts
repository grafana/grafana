import { PluginMeta, PluginSignatureType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getPluginSettings } from '../pluginSettings';

import {
  shouldLoadPluginInFrontendSandbox,
  setSandboxEnabledCheck,
  isPluginFrontendSandboxEnabled,
  isPluginFrontendSandboxEligible,
} from './sandbox_plugin_loader_registry';

jest.mock('@grafana/runtime', () => ({
  config: {
    featureToggles: { pluginsFrontendSandbox: true },
    buildInfo: { env: 'production' },
    enableFrontendSandboxForPlugins: [],
  },
}));

jest.mock('../pluginSettings', () => ({
  getPluginSettings: jest.fn(),
}));

const getPluginSettingsMock = getPluginSettings as jest.MockedFunction<typeof getPluginSettings>;

const fakePlugin: PluginMeta = {
  id: 'test-plugin',
  name: 'Test Plugin',
} as PluginMeta;

describe('Sandbox eligibility checks', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    config.enableFrontendSandboxForPlugins = [];
    config.featureToggles.pluginsFrontendSandbox = true;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('shouldLoadPluginInFrontendSandbox returns false for Angular plugins', async () => {
    const result = await shouldLoadPluginInFrontendSandbox({ isAngular: true, pluginId: 'test-plugin' });
    expect(result).toBe(false);
  });

  test('shouldLoadPluginInFrontendSandbox returns false when feature toggle is off', async () => {
    config.featureToggles.pluginsFrontendSandbox = false;
    const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
    expect(result).toBe(false);
  });

  test('shouldLoadPluginInFrontendSandbox returns false for Grafana-signed plugins', async () => {
    getPluginSettingsMock.mockResolvedValue({ ...fakePlugin, signatureType: PluginSignatureType.grafana });
    const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
    expect(result).toBe(false);
  });

  test('shouldLoadPluginInFrontendSandbox returns true for eligible plugins in the list', async () => {
    getPluginSettingsMock.mockResolvedValue({ ...fakePlugin, signatureType: PluginSignatureType.community });
    config.enableFrontendSandboxForPlugins = ['test-plugin'];
    const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
    expect(result).toBe(true);
  });

  test('isPluginFrontendSandboxEnabled returns false when plugin is not in the enabled list', async () => {
    config.enableFrontendSandboxForPlugins = ['other-plugin'];
    const result = await isPluginFrontendSandboxEnabled({ pluginId: 'test-plugin' });
    expect(result).toBe(false);
  });

  test('setSandboxEnabledCheck sets custom check function', async () => {
    const customCheck = jest.fn().mockResolvedValue(true);
    setSandboxEnabledCheck(customCheck);
    const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
    expect(customCheck).toHaveBeenCalledWith({ pluginId: 'test-plugin' });
    expect(result).toBe(true);
  });

  test('setSandboxEnabledCheck has precedence over default', async () => {
    const customCheck = jest.fn().mockResolvedValue(false);
    setSandboxEnabledCheck(customCheck);
    // this should be ignored by the custom check
    config.enableFrontendSandboxForPlugins = ['test-plugin'];
    const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
    expect(customCheck).toHaveBeenCalledWith({ pluginId: 'test-plugin' });
    expect(result).toBe(false);
  });

  test('isPluginFrontendSandboxEligible returns false for plugins with internal signature', async () => {
    //@ts-expect-error We don't publicly export the internal signature
    getPluginSettingsMock.mockResolvedValue({ ...fakePlugin, signature: 'internal' });
    const result = await isPluginFrontendSandboxEligible({ pluginId: 'test-plugin' });
    expect(result).toBe(false);
  });
});
