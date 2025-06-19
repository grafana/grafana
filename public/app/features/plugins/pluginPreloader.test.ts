import {
  PluginLoadingStrategy,
  PluginType,
  type PluginMeta,
  type PluginMetaInfo,
  type AngularMeta,
  type PluginDependencies,
  type PluginExtensions,
} from '@grafana/data';
import type { AppPluginConfig } from '@grafana/runtime';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { clearPreloadedPluginsCache, preloadPlugins } from './pluginPreloader';
import { importAppPlugin } from './plugin_loader';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: {
      orgRole: 'Admin',
    },
  },
}));

jest.mock('app/features/plugins/pluginSettings', () => ({
  getPluginSettings: jest.fn(),
}));

jest.mock('./plugin_loader', () => ({
  importAppPlugin: jest.fn(),
}));

const getPluginSettingsMock = jest.mocked(getPluginSettings);
const importAppPluginMock = jest.mocked(importAppPlugin);

const createMockAppPluginConfig = (overrides: Partial<AppPluginConfig> = {}): AppPluginConfig => ({
  id: 'test-plugin',
  path: '/path/to/plugin',
  version: '1.0.0',
  preload: true,
  angular: { detected: false, hideDeprecation: false } as AngularMeta,
  loadingStrategy: PluginLoadingStrategy.fetch,
  dependencies: {
    grafanaVersion: '*',
    plugins: [],
    extensions: { exposedComponents: [] },
  } as PluginDependencies,
  extensions: {
    addedComponents: [],
    addedLinks: [],
    addedFunctions: [],
    exposedComponents: [],
    extensionPoints: [],
  } as PluginExtensions,
  ...overrides,
});

const createMockPluginMeta = (overrides: Partial<PluginMeta> = {}): PluginMeta => ({
  id: 'test-plugin',
  name: 'Test Plugin',
  type: PluginType.app,
  info: {
    author: {
      name: 'Test Author',
      url: 'https://example.com',
    },
    description: 'Test plugin description',
    links: [],
    logos: {
      small: 'small-logo.png',
      large: 'large-logo.png',
    },
    screenshots: [],
    updated: '2023-01-01',
    version: '1.0.0',
  } as PluginMetaInfo,
  module: 'module.js',
  baseUrl: 'base-url',
  ...overrides,
});

describe('pluginPreloader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    clearPreloadedPluginsCache();
  });

  describe('preloadPlugins()', () => {
    it('should return early when no apps are provided', async () => {
      await preloadPlugins([]);

      expect(getPluginSettingsMock).not.toHaveBeenCalled();
      expect(importAppPluginMock).not.toHaveBeenCalled();
    });

    it('should return early when called with no arguments', async () => {
      await preloadPlugins();

      expect(getPluginSettingsMock).not.toHaveBeenCalled();
      expect(importAppPluginMock).not.toHaveBeenCalled();
    });

    it('should preload a single plugin successfully', async () => {
      const appConfig = createMockAppPluginConfig({
        id: 'test-plugin',
        path: '/path/to/plugin',
        version: '1.0.0',
      });

      const mockPluginMeta = createMockPluginMeta({
        id: 'test-plugin',
        name: 'Test Plugin',
        type: PluginType.app,
      });

      getPluginSettingsMock.mockResolvedValue(mockPluginMeta);
      importAppPluginMock.mockResolvedValue({} as any);

      await preloadPlugins([appConfig]);

      expect(getPluginSettingsMock).toHaveBeenCalledWith('test-plugin', {
        showErrorAlert: true,
      });
      expect(importAppPluginMock).toHaveBeenCalledWith(mockPluginMeta);
    });

    it('should preload multiple plugins successfully', async () => {
      const appConfigs = [
        createMockAppPluginConfig({
          id: 'plugin-1',
          path: '/path/to/plugin1',
          version: '1.0.0',
        }),
        createMockAppPluginConfig({
          id: 'plugin-2',
          path: '/path/to/plugin2',
          version: '2.0.0',
        }),
      ];

      const mockPluginMeta1 = createMockPluginMeta({
        id: 'plugin-1',
        name: 'Plugin 1',
        type: PluginType.app,
      });

      const mockPluginMeta2 = createMockPluginMeta({
        id: 'plugin-2',
        name: 'Plugin 2',
        type: PluginType.app,
      });

      getPluginSettingsMock.mockResolvedValueOnce(mockPluginMeta1).mockResolvedValueOnce(mockPluginMeta2);
      importAppPluginMock.mockResolvedValue({} as any);

      await preloadPlugins(appConfigs);

      expect(getPluginSettingsMock).toHaveBeenCalledTimes(2);
      expect(getPluginSettingsMock).toHaveBeenNthCalledWith(1, 'plugin-1', {
        showErrorAlert: true,
      });
      expect(getPluginSettingsMock).toHaveBeenNthCalledWith(2, 'plugin-2', {
        showErrorAlert: true,
      });
      expect(importAppPluginMock).toHaveBeenCalledTimes(2);
      expect(importAppPluginMock).toHaveBeenNthCalledWith(1, mockPluginMeta1);
      expect(importAppPluginMock).toHaveBeenNthCalledWith(2, mockPluginMeta2);
    });

    it('should not preload already preloaded plugins', async () => {
      const appConfigs = [
        createMockAppPluginConfig({
          id: 'plugin-1',
          path: '/path/to/plugin1',
          version: '1.0.0',
        }),
      ];

      const mockPluginMeta = createMockPluginMeta({
        id: 'plugin-1',
        name: 'Plugin 1',
        type: PluginType.app,
      });

      getPluginSettingsMock.mockResolvedValue(mockPluginMeta);
      importAppPluginMock.mockResolvedValue({} as any);

      await preloadPlugins(appConfigs);
      await preloadPlugins(appConfigs);
      await preloadPlugins(appConfigs);

      expect(getPluginSettingsMock).toHaveBeenCalledTimes(1);
      expect(importAppPluginMock).toHaveBeenCalledTimes(1);
    });

    it('should not preload plugins twice, even if the initial has not finished yet', async () => {
      const appConfigs = [
        createMockAppPluginConfig({
          id: 'plugin-1',
          path: '/path/to/plugin1',
          version: '1.0.0',
        }),
      ];

      const mockPluginMeta = createMockPluginMeta({
        id: 'plugin-1',
        name: 'Plugin 1',
        type: PluginType.app,
      });

      getPluginSettingsMock.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockPluginMeta), 100))
      );
      importAppPluginMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({} as any), 100)));

      // We are not awaiting the first call, so the second one kicks off before the first one has finished
      preloadPlugins(appConfigs);
      await preloadPlugins(appConfigs);

      expect(getPluginSettingsMock).toHaveBeenCalledTimes(1);
      expect(importAppPluginMock).toHaveBeenCalledTimes(1);
    });

    it('should not preload plugins twice, even if the upcoming calls have a different set of plugins', async () => {
      const appConfig1 = createMockAppPluginConfig({
        id: 'plugin-1',
        path: '/path/to/plugin1',
        version: '1.0.0',
      });

      const appConfig2 = createMockAppPluginConfig({
        id: 'plugin-2',
        path: '/path/to/plugin2',
        version: '2.0.0',
      });

      const mockPluginMeta1 = createMockPluginMeta({
        id: 'plugin-1',
        name: 'Plugin 1',
        type: PluginType.app,
      });

      const mockPluginMeta2 = createMockPluginMeta({
        id: 'plugin-2',
        name: 'Plugin 2',
        type: PluginType.app,
      });

      getPluginSettingsMock
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(mockPluginMeta1), 100)))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(mockPluginMeta2), 100)));
      importAppPluginMock
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({} as any), 100)))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({} as any), 100)));

      preloadPlugins([appConfig1]);
      await preloadPlugins([appConfig1, appConfig2]);

      // If there is no cache, these would be called three times
      expect(getPluginSettingsMock).toHaveBeenCalledTimes(2);
      expect(importAppPluginMock).toHaveBeenCalledTimes(2);
    });
  });
});
