import { PluginMeta, PluginSignatureStatus, PluginSignatureType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { getPluginDetails } from '../admin/api';
import { CatalogPluginDetails } from '../admin/types';
import { getPluginSettings } from '../pluginSettings';

import {
  shouldLoadPluginInFrontendSandbox,
  setSandboxEnabledCheck,
  isPluginFrontendSandboxEnabled,
  isPluginFrontendSandboxEligible,
} from './sandboxPluginLoaderRegistry';

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

jest.mock('../admin/api', () => ({
  getPluginDetails: jest.fn(),
}));

const getPluginSettingsMock = jest.mocked(getPluginSettings);
const getPluginDetailsMock = jest.mocked(getPluginDetails);
const mockContextSrv = jest.mocked(contextSrv);

const fakePluginSettings: PluginMeta = {
  id: 'test-plugin',
  name: 'Test Plugin',
} as PluginMeta;

const fakePluginDetails: CatalogPluginDetails = {} as CatalogPluginDetails;

describe('Sandbox eligibility checks', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    getPluginDetailsMock.mockReset();
    getPluginSettingsMock.mockReset();
    mockContextSrv.isSignedIn = true;

    // restore default check
    setSandboxEnabledCheck(isPluginFrontendSandboxEnabled);

    config.enableFrontendSandboxForPlugins = [];
    config.featureToggles.pluginsFrontendSandbox = true;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('isPluginFrontendSandboxEligible returns false for unsigned users', async () => {
    mockContextSrv.isSignedIn = false;
    const isEligible = await isPluginFrontendSandboxEligible({ pluginId: 'test-plugin' });
    expect(isEligible).toBe(false);
  });

  test('shouldLoadPluginInFrontendSandbox returns false when feature toggle is off', async () => {
    config.featureToggles.pluginsFrontendSandbox = false;
    const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
    expect(result).toBe(false);
  });

  test('setSandboxEnabledCheck sets custom check function', async () => {
    getPluginDetailsMock.mockResolvedValue(fakePluginDetails);
    const customCheck = jest.fn().mockResolvedValue(true);
    setSandboxEnabledCheck(customCheck);
    const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
    expect(customCheck).toHaveBeenCalledWith({ pluginId: 'test-plugin' });
    expect(result).toBe(true);
  });

  test('setSandboxEnabledCheck has precedence over default', async () => {
    getPluginDetailsMock.mockResolvedValue(fakePluginDetails);
    const customCheck = jest.fn().mockResolvedValue(false);
    setSandboxEnabledCheck(customCheck);
    // this should be ignored by the custom check
    config.enableFrontendSandboxForPlugins = ['test-plugin'];
    const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
    expect(customCheck).toHaveBeenCalledWith({ pluginId: 'test-plugin' });
    expect(result).toBe(false);
  });

  describe('with getPluginDetails', () => {
    test('shouldLoadPluginInFrontendSandbox returns false for Grafana-signed plugins', async () => {
      getPluginSettingsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginDetailsMock.mockResolvedValue({ ...fakePluginDetails, signatureType: PluginSignatureType.grafana });

      const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
      expect(result).toBe(false);
    });

    test('shouldLoadPluginInFrontendSandbox returns true for community plugins', async () => {
      getPluginSettingsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginDetailsMock.mockResolvedValue({ ...fakePluginDetails, signatureType: PluginSignatureType.community });

      config.enableFrontendSandboxForPlugins = ['test-plugin'];
      const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
      expect(result).toBe(true);
    });

    test('isPluginFrontendSandboxEnabled returns false when plugin is not in the enabled list', async () => {
      getPluginSettingsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginDetailsMock.mockResolvedValue({ ...fakePluginDetails, signatureType: PluginSignatureType.community });
      config.enableFrontendSandboxForPlugins = ['other-plugin'];
      const result = await isPluginFrontendSandboxEnabled({ pluginId: 'test-plugin' });
      expect(result).toBe(false);
    });

    test('shouldLoadPluginInFrontendSandbox returns true for commercial plugins in the enabled list', async () => {
      getPluginSettingsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginDetailsMock.mockResolvedValue({ ...fakePluginDetails, signatureType: PluginSignatureType.commercial });
      config.enableFrontendSandboxForPlugins = ['test-plugin'];
      const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
      expect(result).toBe(true);
    });

    test('shouldLoadPluginInFrontendSandbox returns true for private plugins in the enabled list', async () => {
      getPluginSettingsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginDetailsMock.mockResolvedValue({ ...fakePluginDetails, signatureType: PluginSignatureType.private });
      config.enableFrontendSandboxForPlugins = ['test-plugin'];
      const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
      expect(result).toBe(true);
    });

    test('isPluginFrontendSandboxEligible returns false for plugins with internal signature', async () => {
      getPluginSettingsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginDetailsMock.mockResolvedValue({
        ...fakePluginDetails,
        signatureType: PluginSignatureType.community,
        signature: PluginSignatureStatus.internal,
      });

      const result = await isPluginFrontendSandboxEligible({ pluginId: 'test-plugin' });
      expect(result).toBe(false);
    });
  });

  describe('with getPluginSettings', () => {
    test('shouldLoadPluginInFrontendSandbox returns false for Grafana-signed plugins', async () => {
      // if getPluginDetails fails it fallsback to getPluginSettings
      getPluginDetailsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginSettingsMock.mockResolvedValue({ ...fakePluginSettings, signatureType: PluginSignatureType.grafana });
      const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
      expect(result).toBe(false);
    });

    test('shouldLoadPluginInFrontendSandbox returns true for eligible plugins in the list', async () => {
      // if getPluginDetails fails it fallsback to getPluginSettings
      getPluginDetailsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginSettingsMock.mockResolvedValue({ ...fakePluginSettings, signatureType: PluginSignatureType.community });
      config.enableFrontendSandboxForPlugins = ['test-plugin'];
      const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
      expect(result).toBe(true);
    });

    test('isPluginFrontendSandboxEnabled returns false when plugin is not in the enabled list', async () => {
      // if getPluginDetails fails it fallsback to getPluginSettings
      getPluginDetailsMock.mockRejectedValueOnce(new Error('not found'));

      config.enableFrontendSandboxForPlugins = ['other-plugin'];
      const result = await isPluginFrontendSandboxEnabled({ pluginId: 'test-plugin' });
      expect(result).toBe(false);
    });

    test('shouldLoadPluginInFrontendSandbox returns true for commercial plugins in the enabled list', async () => {
      // if getPluginDetails fails it fallsback to getPluginSettings
      getPluginDetailsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginSettingsMock.mockResolvedValue({ ...fakePluginSettings, signatureType: PluginSignatureType.commercial });
      config.enableFrontendSandboxForPlugins = ['test-plugin'];
      const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
      expect(result).toBe(true);
    });

    test('shouldLoadPluginInFrontendSandbox returns true for private plugins in the enabled list', async () => {
      // if getPluginDetails fails it fallsback to getPluginSettings
      getPluginDetailsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginSettingsMock.mockResolvedValue({ ...fakePluginSettings, signatureType: PluginSignatureType.private });
      config.enableFrontendSandboxForPlugins = ['test-plugin'];
      const result = await shouldLoadPluginInFrontendSandbox({ pluginId: 'test-plugin' });
      expect(result).toBe(true);
    });

    test('isPluginFrontendSandboxEligible returns false for plugins with internal signature', async () => {
      // if getPluginDetails fails it fallsback to getPluginSettings
      getPluginDetailsMock.mockRejectedValueOnce(new Error('not found'));

      getPluginSettingsMock.mockResolvedValue({ ...fakePluginSettings, signature: PluginSignatureStatus.internal });
      const result = await isPluginFrontendSandboxEligible({ pluginId: 'test-plugin' });
      expect(result).toBe(false);
    });
  });
});
