import {
  AppPlugin,
  type AppPluginMeta,
  DataSourcePlugin,
  type DataSourcePluginMeta,
  PanelPlugin,
  type PanelPluginMeta,
  PluginLoadingStrategy,
  type PluginMeta,
  PluginType,
} from '@grafana/data';

import { AddedComponentsRegistry } from '../extensions/registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from '../extensions/registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from '../extensions/registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from '../extensions/registry/ExposedComponentsRegistry';
import { PluginLoadError } from '../loader/pluginLoadError';

import * as importPluginModule from './importPluginModule';
import { pluginImporter, clearCaches } from './pluginImporter';

const mockLogError = jest.fn();

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getLogger: () => ({ logError: mockLogError, logDebug: jest.fn() }),
}));

jest.mock('../extensions/registry/setup', () => ({
  ...jest.requireActual('../extensions/registry/setup'),
  getPluginExtensionRegistries: jest.fn(),
}));

const { getPluginExtensionRegistries } = jest.requireMock('../extensions/registry/setup');
const getPluginExtensionRegistriesMock = jest.mocked(getPluginExtensionRegistries);

describe('pluginImporter', () => {
  let exposedComponentsRegistry: ExposedComponentsRegistry;
  let addedComponentsRegistry: AddedComponentsRegistry;
  let addedLinksRegistry: AddedLinksRegistry;
  let addedFunctionsRegistry: AddedFunctionsRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    clearCaches();
    addedComponentsRegistry = new AddedComponentsRegistry([]);
    addedFunctionsRegistry = new AddedFunctionsRegistry([]);
    addedLinksRegistry = new AddedLinksRegistry([]);
    exposedComponentsRegistry = new ExposedComponentsRegistry([]);

    addedComponentsRegistry.register = jest.fn();
    addedFunctionsRegistry.register = jest.fn();
    addedLinksRegistry.register = jest.fn();
    exposedComponentsRegistry.register = jest.fn();

    const registries = {
      addedComponentsRegistry,
      addedFunctionsRegistry,
      addedLinksRegistry,
      exposedComponentsRegistry,
    };

    getPluginExtensionRegistriesMock.mockResolvedValue(registries);
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
        pluginType: 'panel',
        pluginName: 'Test Plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });

      expect(result).toEqual({ ...panelPlugin, meta: { ...panelPlugin } });
    });

    it('should import a panel plugin returning a Promise<PanelPlugin> successfully', async () => {
      const spy = jest
        .spyOn(importPluginModule, 'importPluginModule')
        .mockResolvedValue({ plugin: Promise.resolve({ ...panelPlugin }) });

      const result = await pluginImporter.importPanel({ ...panelPlugin });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        pluginType: 'panel',
        pluginName: 'Test Plugin',
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
        pluginType: 'panel',
        pluginName: 'Test Plugin',
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
        pluginType: 'panel',
        pluginName: 'Test Plugin',
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
        pluginType: 'datasource',
        pluginName: 'Test Plugin',
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
        pluginType: 'datasource',
        pluginName: 'Test Plugin',
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
        pluginType: 'datasource',
        pluginName: 'Test Plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });

      expect(result).toEqual({ ...dataSourcePlugin, meta: { ...dataSourcePlugin, loadingStrategy: 'script' } });
    });

    it('should throw error if module is missing exported plugin', async () => {
      const spy = jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({});

      await expect(pluginImporter.importDataSource({ ...dataSourcePlugin })).rejects.toThrow(
        new Error('Plugin module is missing DataSourcePlugin or Datasource constructor export')
      );

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        pluginType: 'datasource',
        pluginName: 'Test Plugin',
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

      const spy = jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({ ...plugin });

      const result = await pluginImporter.importApp({ ...appPlugin });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        pluginType: 'app',
        pluginName: 'Test Plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });
      expect(init).toHaveBeenCalledWith({ ...appPlugin });
      expect(setComponentsFromLegacyExports).toHaveBeenCalledWith({ ...plugin });
      expect(addedComponentsRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        pluginMeta: { ...appPlugin },
        configs: [{}],
      });
      expect(addedLinksRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        configs: [{}],
      });
      expect(addedFunctionsRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        configs: [{}],
      });

      expect(exposedComponentsRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        configs: [{}],
      });

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

      const spy = jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({ ...plugin });
      const meta = { ...appPlugin, loadingStrategy: PluginLoadingStrategy.script };

      const result = await pluginImporter.importApp({ ...meta });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'script',
        pluginId: 'test-plugin',
        pluginType: 'app',
        pluginName: 'Test Plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });
      expect(init).toHaveBeenCalledWith({ ...meta });
      expect(setComponentsFromLegacyExports).toHaveBeenCalledWith({ ...plugin });
      expect(addedComponentsRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        pluginMeta: { ...meta },
        configs: [{}],
      });
      expect(addedLinksRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        configs: [{}],
      });
      expect(addedFunctionsRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        configs: [{}],
      });

      expect(exposedComponentsRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        configs: [{}],
      });

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
      const spy = jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({});

      const result = await pluginImporter.importApp({ ...appPlugin });

      expect(spy).toHaveBeenCalledWith({
        path: 'public/plugins/test-plugin/module.js',
        version: '1.0.0',
        loadingStrategy: 'fetch',
        pluginId: 'test-plugin',
        pluginType: 'app',
        pluginName: 'Test Plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });

      expect(addedComponentsRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        pluginMeta: { ...appPlugin },
        configs: [],
      });
      expect(addedLinksRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        configs: [],
      });
      expect(addedFunctionsRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        configs: [],
      });

      expect(exposedComponentsRegistry.register).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        configs: [],
      });

      expect(result).toEqual({ ...new AppPlugin(), meta: { ...appPlugin } });
    });
  });

  describe('logging failures after the module has loaded', () => {
    const loadError = new PluginLoadError('Could not load plugin', {
      cause: new Error('boom'),
      errorType: 'evaluation',
      httpStatusSource: 'none',
    });

    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('logs a panel with a missing export as invalid-module and still returns the error panel', async () => {
      jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({});

      const result = await pluginImporter.importPanel({ ...panelPlugin });

      expect(result).toBeInstanceOf(PanelPlugin);
      expect(mockLogError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Could not initialise plugin' }), {
        pluginId: 'test-plugin',
        pluginType: 'panel',
        pluginVersion: '1.0.0',
        errorType: 'invalid-module',
        originalErrorMessage: 'missing export: plugin',
      });
    });

    it('logs a panel whose plugin export rejects as evaluation', async () => {
      jest
        .spyOn(importPluginModule, 'importPluginModule')
        .mockResolvedValue({ plugin: Promise.reject(new Error('setup failed')) });

      await pluginImporter.importPanel({ ...panelPlugin });

      expect(mockLogError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ errorType: 'evaluation', originalErrorMessage: 'setup failed' })
      );
    });

    it('logs an Angular panel as angular', async () => {
      jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({ PanelCtrl: class {} });

      await pluginImporter.importPanel({ ...panelPlugin });

      expect(mockLogError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ errorType: 'angular' }));
    });

    it('logs a data source with a missing export as invalid-module and still throws the original error', async () => {
      jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({});

      await expect(pluginImporter.importDataSource({ ...dataSourcePlugin })).rejects.toThrow(
        'Plugin module is missing DataSourcePlugin or Datasource constructor export'
      );
      expect(mockLogError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ pluginType: 'datasource', errorType: 'invalid-module' })
      );
    });

    it('logs an app whose init throws as evaluation and still throws the original error', async () => {
      const initError = new Error('init failed');
      const plugin = new AppPlugin();
      plugin.init = () => {
        throw initError;
      };
      jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({ plugin });

      await expect(pluginImporter.importApp({ ...appPlugin })).rejects.toBe(initError);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ pluginType: 'app', errorType: 'evaluation', originalErrorMessage: 'init failed' })
      );
    });

    it('logs an Angular app as angular', async () => {
      jest.spyOn(importPluginModule, 'importPluginModule').mockResolvedValue({ ConfigCtrl: class {} });

      await expect(pluginImporter.importApp({ ...appPlugin })).rejects.toThrow('Angular plugins are not supported');
      expect(mockLogError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ errorType: 'angular' }));
    });

    it.each`
      importer                                                          | description
      ${() => pluginImporter.importPanel({ ...panelPlugin })}           | ${'panel'}
      ${() => pluginImporter.importDataSource({ ...dataSourcePlugin })} | ${'data source'}
      ${() => pluginImporter.importApp({ ...appPlugin })}               | ${'app'}
    `('does not log a $description load failure a second time', async ({ importer }) => {
      jest.spyOn(importPluginModule, 'importPluginModule').mockRejectedValue(loadError);

      await importer().catch(() => {});

      expect(mockLogError).not.toHaveBeenCalled();
    });
  });

  describe('caches', () => {
    it('should return a cached plugin if it exsits', async () => {
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
        pluginType: 'panel',
        pluginName: 'Test Plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
      });
      expect(cached).toBe(original);
    });

    it('should return an inflight plugin load if it exsits', async () => {
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
        pluginType: 'panel',
        pluginName: 'Test Plugin',
        moduleHash: 'cc3e6f370520e1efc6043f1874d735fabc710d4b',
        translations: { 'en-US': 'public/plugins/test-plugin/locales/en-US/test-plugin.json' },
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
