import {
  PluginLoadingStrategy,
  PluginType,
  type AppPluginConfig,
  type PluginMeta,
  type PluginMetaInfo,
  type AngularMeta,
  type PluginDependencies,
  type PluginExtensions,
  AppPlugin,
  OrgRole,
} from '@grafana/data';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { pluginImporter } from './importer/pluginImporter';
import { clearPreloadedPluginsCache, preloadPlugins } from './pluginPreloader';

jest.mock('app/features/plugins/pluginSettings', () => ({
  getPluginSettings: jest.fn(),
}));

jest.mock('./importer/pluginImporter', () => ({
  pluginImporter: { importApp: jest.fn() },
}));

const getPluginSettingsMock = jest.mocked(getPluginSettings);
const importAppPluginMock = jest.mocked(pluginImporter.importApp);

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
    const contextSrv = new ContextSrv();
    contextSrv.user.orgRole = OrgRole.Admin;
    setContextSrv(contextSrv);
    jest.clearAllMocks();
    jest.resetModules();
    clearPreloadedPluginsCache();
  });

  afterEach(() => {
    jest.useRealTimers();
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
      importAppPluginMock.mockResolvedValue(new AppPlugin());

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
      importAppPluginMock.mockResolvedValue(new AppPlugin());

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
      importAppPluginMock.mockResolvedValue(new AppPlugin());

      await preloadPlugins(appConfigs);
      await preloadPlugins(appConfigs);
      await preloadPlugins(appConfigs);

      expect(getPluginSettingsMock).toHaveBeenCalledTimes(1);
      expect(importAppPluginMock).toHaveBeenCalledTimes(1);
    });

    it('should not preload plugins twice, even if the initial has not finished yet', async () => {
      jest.useFakeTimers();

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
      importAppPluginMock.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(new AppPlugin()), 100))
      );

      preloadPlugins(appConfigs);
      preloadPlugins(appConfigs);
      await jest.runAllTimersAsync();

      expect(getPluginSettingsMock).toHaveBeenCalledTimes(1);
      expect(importAppPluginMock).toHaveBeenCalledTimes(1);
    });

    it('should not preload plugins twice, even if the upcoming calls have a different set of plugins', async () => {
      jest.useFakeTimers();

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
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(new AppPlugin()), 100)))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(new AppPlugin()), 100)));

      preloadPlugins([appConfig1]);
      preloadPlugins([appConfig1, appConfig2]);
      await jest.runAllTimersAsync();

      // If there is no cache, these would be called three times
      expect(getPluginSettingsMock).toHaveBeenCalledTimes(2);
      expect(importAppPluginMock).toHaveBeenCalledTimes(2);
    });

    it('should have showErrorAlert set to false for user with no role', async () => {
      const contextSrv = new ContextSrv();
      contextSrv.user.orgRole = '';
      setContextSrv(contextSrv);

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
      importAppPluginMock.mockResolvedValue(new AppPlugin());

      await preloadPlugins([appConfig]);

      expect(getPluginSettingsMock).toHaveBeenCalledWith('test-plugin', {
        showErrorAlert: false,
      });
      expect(importAppPluginMock).toHaveBeenCalledWith(mockPluginMeta);
    });

    it('should log all errors for user with role', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const appConfig = createMockAppPluginConfig({
        id: 'test-plugin',
        path: '/path/to/plugin',
        version: '1.0.0',
      });
      const error = { status: 401, message: 'Unauthorized' };

      getPluginSettingsMock.mockRejectedValue(error);

      await preloadPlugins([appConfig]);

      expect(consoleSpy).toHaveBeenCalledWith(
        `[Plugins] Failed to preload plugin: /path/to/plugin (version: 1.0.0)`,
        error
      );
    });

    it('should not log any errors for user without role', async () => {
      const contextSrv = new ContextSrv();
      contextSrv.user.orgRole = '';
      setContextSrv(contextSrv);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const appConfig = createMockAppPluginConfig({
        id: 'test-plugin',
        path: '/path/to/plugin',
        version: '1.0.0',
      });
      const error = { status: 401, message: 'Unauthorized' };

      getPluginSettingsMock.mockRejectedValue(error);

      await preloadPlugins([appConfig]);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
