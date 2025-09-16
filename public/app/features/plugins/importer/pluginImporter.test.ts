import {
  AppPlugin,
  AppPluginMeta,
  DataSourcePlugin,
  DataSourcePluginMeta,
  PanelPlugin,
  PanelPluginMeta,
  PluginLoadingStrategy,
  PluginMeta,
  PluginType,
} from '@grafana/data';

import {
  addedComponentsRegistry,
  addedFunctionsRegistry,
  addedLinksRegistry,
  exposedComponentsRegistry,
} from '../extensions/registry/setup';
import { pluginsLogger } from '../utils';

import * as importPluginModule from './importPluginModule';
import { pluginImporter, clearCaches } from './pluginImporter';

describe('pluginImporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCaches();
  });

  describe('importPanel', () => {
    it('should import a panel plugin successfully with fallbackLoadingStrategy', async () => {
      const spy = jest
        .spyOn(importPluginModule, 'importPluginModule')
        .mockResolvedValue({ plugin: { ...panelPlugin } });

      const result = await pluginImporter.importPanel({ ...panelPlugin });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });

      expect(result).toEqual({ ...panelPlugin, meta: { ...panelPlugin } });
    });

    it('should set correct loading strategy', async () => {
      const spy = jest
        .spyOn(importPluginModule, 'importPluginModule')
        .mockResolvedValue({ plugin: { ...panelPlugin } });
      const meta = { ...panelPlugin, loadingStrategy: PluginLoadingStrategy.script };

      const result = await pluginImporter.importPanel({ ...meta });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'script',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });

      expect(result).toEqual({ ...panelPlugin, meta: { ...panelPlugin, loadingStrategy: 'script' } });
    });

    it('should log a warning and return a error component if module is missing exported plugin', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const spy = jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({});

      const result = await pluginImporter.importPanel({ ...panelPlugin });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading panel plugin: test-plugin',
        new Error('missing export: plugin')
      );

      expect(result).toBeInstanceOf(PanelPlugin);
      expect(result.loadError).toBe(true);
    });
  });

  describe('importDataSource', () => {
    it('should import a data source plugin successfully with fallbackLoadingStrategy', async () => {
      const spy = jest
        .spyOn(importPluginModule, 'importPluginModule')
        .mockResolvedValue({ plugin: { ...dataSourcePlugin } });

      const result = await pluginImporter.importDataSource({ ...dataSourcePlugin });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });

      expect(result).toEqual({ ...dataSourcePlugin, meta: { ...dataSourcePlugin } });
    });

    it('should import a data source plugin with Datasource prop', async () => {
      const spy = jest
        .spyOn(importPluginModule, 'importPluginModule')
        .mockResolvedValue({ Datasource: { ...dataSourcePlugin } });

      const result = await pluginImporter.importDataSource({ ...dataSourcePlugin });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DataSourceClass: any = { ...dataSourcePlugin };
      const expected = new DataSourcePlugin(DataSourceClass);
      expect(result).toEqual({
        ...expected,
        components: {
          AnnotationsQueryCtrl: undefined,
          ExploreQueryField: undefined,
          QueryCtrl: undefined,
          QueryEditor: undefined,
          QueryEditorHelp: undefined,
          VariableQueryEditor: undefined,
        },
        meta: { ...dataSourcePlugin },
      });
    });

    it('should set correct loading strategy', async () => {
      const spy = jest
        .spyOn(importPluginModule, 'importPluginModule')
        .mockResolvedValue({ plugin: { ...dataSourcePlugin } });
      const meta = { ...dataSourcePlugin, loadingStrategy: PluginLoadingStrategy.script };

      const result = await pluginImporter.importDataSource({ ...meta });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'script',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });

      expect(result).toEqual({ ...dataSourcePlugin, meta: { ...dataSourcePlugin, loadingStrategy: 'script' } });
    });

    it('should throw error if module is missing exported plugin', async () => {
      const spy = jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({});

      expect(async () => {
        await pluginImporter.importDataSource({ ...dataSourcePlugin });
      }).rejects.toThrow(new Error('Plugin module is missing DataSourcePlugin or Datasource constructor export'));

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });
    });
  });

  describe('importApp', () => {
    it('should import a app plugin successfully with fallbackLoadingStrategy', async () => {
      const init = jest.fn();
      const setComponentsFromLegacyExports = jest.fn();
      const plugin = {
        plugin: {
          ...appPlugin,
          init,
          setComponentsFromLegacyExports,
          exposedComponentConfigs: [{}],
          addedComponentConfigs: [{}],
          addedLinkConfigs: [{}],
          addedFunctionConfigs: [{}],
        },
      };
      const exposedComponentsRegistrySpy = jest
        .spyOn(exposedComponentsRegistry, 'register')
        .mockImplementation(() => {});
      const addedComponentsRegistrySpy = jest.spyOn(addedComponentsRegistry, 'register').mockImplementation(() => {});
      const addedLinksRegistrySpy = jest.spyOn(addedLinksRegistry, 'register').mockImplementation(() => {});
      const addedFunctionsRegistrySpy = jest.spyOn(addedFunctionsRegistry, 'register').mockImplementation(() => {});
      const spy = jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({ ...plugin });

      const result = await pluginImporter.importApp({ ...appPlugin });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });
      expect(init).toHaveBeenCalledWith({ ...appPlugin });
      expect(setComponentsFromLegacyExports).toHaveBeenCalledWith({ ...plugin });
      expect(exposedComponentsRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [{}] });
      expect(addedComponentsRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [{}] });
      expect(addedLinksRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [{}] });
      expect(addedFunctionsRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [{}] });

      expect(result).toEqual({
        ...appPlugin,
        meta: { ...appPlugin },
        init,
        setComponentsFromLegacyExports,
        exposedComponentConfigs: [{}],
        addedComponentConfigs: [{}],
        addedLinkConfigs: [{}],
        addedFunctionConfigs: [{}],
      });
    });

    it('should set correct loading strategy', async () => {
      const init = jest.fn();
      const setComponentsFromLegacyExports = jest.fn();
      const plugin = {
        plugin: {
          ...appPlugin,
          init,
          setComponentsFromLegacyExports,
          exposedComponentConfigs: [{}],
          addedComponentConfigs: [{}],
          addedLinkConfigs: [{}],
          addedFunctionConfigs: [{}],
        },
      };
      const exposedComponentsRegistrySpy = jest
        .spyOn(exposedComponentsRegistry, 'register')
        .mockImplementation(() => {});
      const addedComponentsRegistrySpy = jest.spyOn(addedComponentsRegistry, 'register').mockImplementation(() => {});
      const addedLinksRegistrySpy = jest.spyOn(addedLinksRegistry, 'register').mockImplementation(() => {});
      const addedFunctionsRegistrySpy = jest.spyOn(addedFunctionsRegistry, 'register').mockImplementation(() => {});
      const spy = jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({ ...plugin });
      const meta = { ...appPlugin, loadingStrategy: PluginLoadingStrategy.script };

      const result = await pluginImporter.importApp({ ...meta });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'script',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });
      expect(init).toHaveBeenCalledWith({ ...meta });
      expect(setComponentsFromLegacyExports).toHaveBeenCalledWith({ ...plugin });
      expect(exposedComponentsRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [{}] });
      expect(addedComponentsRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [{}] });
      expect(addedLinksRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [{}] });
      expect(addedFunctionsRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [{}] });

      expect(result).toEqual({
        ...appPlugin,
        meta: { ...appPlugin, loadingStrategy: 'script' },
        init,
        setComponentsFromLegacyExports,
        exposedComponentConfigs: [{}],
        addedComponentConfigs: [{}],
        addedLinkConfigs: [{}],
        addedFunctionConfigs: [{}],
      });
    });

    it('should import an empty app plugin if missing exported plugin', async () => {
      const exposedComponentsRegistrySpy = jest
        .spyOn(exposedComponentsRegistry, 'register')
        .mockImplementation(() => {});
      const addedComponentsRegistrySpy = jest.spyOn(addedComponentsRegistry, 'register').mockImplementation(() => {});
      const addedLinksRegistrySpy = jest.spyOn(addedLinksRegistry, 'register').mockImplementation(() => {});
      const addedFunctionsRegistrySpy = jest.spyOn(addedFunctionsRegistry, 'register').mockImplementation(() => {});
      const spy = jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({});

      const result = await pluginImporter.importApp({ ...appPlugin });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });
      expect(exposedComponentsRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [] });
      expect(addedComponentsRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [] });
      expect(addedLinksRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [] });
      expect(addedFunctionsRegistrySpy).toHaveBeenCalledWith({ pluginId: 'test-plugin', configs: [] });

      expect(result).toEqual({ ...new AppPlugin(), meta: { ...appPlugin } });
    });
  });

  describe('caches', () => {
    it('should return a cached plugin if it exsits', async () => {
      const logSpy = jest.spyOn(pluginsLogger, 'logDebug').mockImplementation(() => {});
      const spy = jest
        .spyOn(importPluginModule, 'importPluginModule')
        .mockResolvedValue({ plugin: { ...panelPlugin } });

      const original = await pluginImporter.importPanel({ ...panelPlugin });
      const cached = await pluginImporter.importPanel({ ...panelPlugin });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });
      expect(logSpy).toHaveBeenCalledWith(`Retrieving plugin from cache`, {
        expectedHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        loadingStrategy: 'fetch',
        newPluginLoadingEnabled: 'false',
        path: 'public/plugins/test-plugin/module.js',
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        sriChecksEnabled: 'false',
      });
      expect(cached).toBe(original);
    });

    it('should return an inflight plugin load if it exsits', async () => {
      const logSpy = jest.spyOn(pluginsLogger, 'logDebug').mockImplementation(() => {});
      const spy = jest
        .spyOn(importPluginModule, 'importPluginModule')
        .mockResolvedValue({ plugin: { ...panelPlugin } });

      const original = pluginImporter.importPanel({ ...panelPlugin });
      const cached = pluginImporter.importPanel({ ...panelPlugin });
      await Promise.all([original, cached]);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });
      expect(logSpy).toHaveBeenCalledWith(`Retrieving plugin from inflight plugin load request`, {
        expectedHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        loadingStrategy: 'fetch',
        newPluginLoadingEnabled: 'false',
        path: 'public/plugins/test-plugin/module.js',
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        sriChecksEnabled: 'false',
      });
      expect(cached).toBe(original);
    });
  });
});

const baseMeta: PluginMeta = {
  id: 'test-plugin',
  name: 'Test Plugin',
  type: '' as PluginType,
  module: 'public/plugins/test-plugin/module.js',
  baseUrl: 'public/plugins/test-plugin',
  moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
  translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
  info: {
    author: { name: 'Test Author' },
    description: 'Test Description',
    links: [],
    logos: { large: '', small: '' },
    screenshots: [],
    updated: '2023-01-01',
    version: '1.0.0',
  },
};

const panelPlugin: PanelPluginMeta = {
  ...baseMeta,
  type: PluginType.panel,
  sort: 0,
};

const dataSourcePlugin: DataSourcePluginMeta = {
  ...baseMeta,
  type: PluginType.datasource,
};

const appPlugin: AppPluginMeta = {
  ...baseMeta,
  type: PluginType.app,
};
