import { act, renderHook } from '@testing-library/react';

import {
  PluginContextProvider,
  PluginExtensionPoints,
  PluginLoadingStrategy,
  PluginMeta,
  PluginType,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { ExtensionRegistriesProvider } from './ExtensionRegistriesContext';
import { log } from './logs/log';
import { resetLogMock } from './logs/testUtils';
import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from './registry/ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './registry/types';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { usePluginFunctions } from './usePluginFunctions';
import { isGrafanaDevMode } from './utils';

jest.mock('./useLoadAppPlugins');
jest.mock('app/features/plugins/pluginSettings', () => ({
  getPluginSettings: jest.fn().mockResolvedValue({
    id: 'my-app-plugin',
    enabled: true,
    jsonData: {},
    type: 'panel',
    name: 'My App Plugin',
    module: 'app/plugins/my-app-plugin/module',
  }),
}));

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),

  // Manually set the dev mode to false
  // (to make sure that by default we are testing a production scenario)
  isGrafanaDevMode: jest.fn().mockReturnValue(false),
}));

jest.mock('./logs/log', () => {
  const { createLogMock } = jest.requireActual('./logs/testUtils');
  const original = jest.requireActual('./logs/log');

  return {
    ...original,
    log: createLogMock(),
  };
});

describe('usePluginFunctions()', () => {
  let registries: PluginExtensionRegistries;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;
  let pluginMeta: PluginMeta;
  const pluginId = 'myorg-extensions-app';
  const extensionPointId = `${pluginId}/extension-point/v1`;

  beforeEach(() => {
    jest.mocked(useLoadAppPlugins).mockReturnValue({ isLoading: false });
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);
    registries = {
      addedComponentsRegistry: new AddedComponentsRegistry(),
      exposedComponentsRegistry: new ExposedComponentsRegistry(),
      addedLinksRegistry: new AddedLinksRegistry(),
      addedFunctionsRegistry: new AddedFunctionsRegistry(),
    };
    resetLogMock(log);

    pluginMeta = {
      id: pluginId,
      name: 'Extensions App',
      type: PluginType.app,
      module: '',
      baseUrl: '',
      info: {
        author: {
          name: 'MyOrg',
        },
        description: 'App for testing extensions',
        links: [],
        logos: {
          large: '',
          small: '',
        },
        screenshots: [],
        updated: '2023-10-26T18:25:01Z',
        version: '1.0.0',
      },
      extensions: {
        addedLinks: [],
        addedComponents: [],
        exposedComponents: [],
        extensionPoints: [],
        addedFunctions: [],
      },
      dependencies: {
        grafanaVersion: '8.0.0',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
    };

    config.apps[pluginId] = {
      id: pluginId,
      path: '',
      version: '',
      preload: false,
      angular: {
        detected: false,
        hideDeprecation: false,
      },
      loadingStrategy: PluginLoadingStrategy.fetch,
      dependencies: {
        grafanaVersion: '8.0.0',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
      extensions: {
        addedLinks: [],
        addedComponents: [],
        addedFunctions: [],
        exposedComponents: [],
        extensionPoints: [],
      },
    };

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider meta={pluginMeta}>
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );
  });

  it('should return an empty array if there are no function extensions registered for the extension point', () => {
    const { result } = renderHook(
      () =>
        usePluginFunctions({
          extensionPointId: 'foo/bar',
        }),
      { wrapper }
    );

    expect(result.current.functions).toEqual([]);
  });

  it('should only return the function extensions for the given extension point ids', async () => {
    registries.addedFunctionsRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          fn: () => 'function1',
        },
        {
          targets: extensionPointId,
          title: '2',
          description: '2',
          fn: () => 'function2',
        },
        {
          targets: 'plugins/another-extension/v1',
          title: '3',
          description: '3',
          fn: () => 'function3',
        },
      ],
    });

    const { result } = renderHook(() => usePluginFunctions({ extensionPointId }), { wrapper });

    expect(result.current.functions.length).toBe(2);
    expect(result.current.functions[0].title).toBe('1');
    expect(result.current.functions[1].title).toBe('2');
  });

  it('should dynamically update the extensions registered for a certain extension point', () => {
    let { result, rerender } = renderHook(() => usePluginFunctions({ extensionPointId }), { wrapper });

    // No extensions yet
    expect(result.current.functions.length).toBe(0);

    // Add extensions to the registry
    act(() => {
      registries.addedFunctionsRegistry.register({
        pluginId,
        configs: [
          {
            targets: extensionPointId,
            title: '1',
            description: '1',
            fn: () => 'function1',
          },
          {
            targets: extensionPointId,
            title: '2',
            description: '2',
            fn: () => 'function2',
          },
        ],
      });
    });

    // Check if the hook returns the new extensions
    rerender();

    expect(result.current.functions.length).toBe(2);
    expect(result.current.functions[0].title).toBe('1');
    expect(result.current.functions[1].title).toBe('2');
  });

  it('should honour the limitPerPlugin arg if its set', () => {
    const plugins = ['my-awesome1-app', 'my-awesome2-app', 'my-awesome3-app'];
    let { result, rerender } = renderHook(() => usePluginFunctions({ extensionPointId, limitPerPlugin: 2 }), {
      wrapper,
    });

    // No extensions yet
    expect(result.current.functions.length).toBe(0);

    // Add extensions to the registry
    act(() => {
      for (let pluginId of plugins) {
        registries.addedFunctionsRegistry.register({
          pluginId,
          configs: [
            {
              targets: [extensionPointId],
              title: '1',
              description: '1',
              fn: () => 'function1',
            },
            {
              targets: [extensionPointId],
              title: '2',
              description: '2',
              fn: () => 'function2',
            },
            {
              targets: [extensionPointId],
              title: '3',
              description: '3',
              fn: () => 'function3',
            },
          ],
        });
      }
    });

    // Check if the hook returns the new extensions
    rerender();

    // Should only return 2 functions per plugin due to limitPerPlugin: 2
    expect(result.current.functions.length).toBe(6);
  });

  it('should return isLoading: true when app plugins are loading', () => {
    jest.mocked(useLoadAppPlugins).mockReturnValue({ isLoading: true });

    const { result } = renderHook(() => usePluginFunctions({ extensionPointId }), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.functions).toEqual([]);
  });

  it('should return isLoading: false when app plugins are not loading', () => {
    jest.mocked(useLoadAppPlugins).mockReturnValue({ isLoading: false });

    const { result } = renderHook(() => usePluginFunctions({ extensionPointId }), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.functions).toEqual([]);
  });

  it('should not validate the extension point meta-info in production mode', () => {
    // Empty list of extension points in the plugin meta (from plugin.json)
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider
        meta={{
          ...pluginMeta,
          extensions: {
            ...pluginMeta.extensions!,
            extensionPoints: [],
          },
        }}
      >
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );

    registries.addedFunctionsRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          fn: () => 'function1',
        },
      ],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    // (No restrictions due to isGrafanaDevMode() = false)
    const { result } = renderHook(() => usePluginFunctions({ extensionPointId }), { wrapper });
    expect(result.current.functions.length).toBe(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  // It can happen that core Grafana plugins (e.g. traces) reuse core components which implement extension points.
  it('should not validate the extension point meta-info for core plugins', () => {
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const functionConfig = {
      targets: extensionPointId,
      title: '1',
      description: '1',
      fn: () => 'function1',
    };

    // The `AddedFunctionsRegistry` is validating if the function is registered in the plugin metadata (config.apps).
    config.apps[pluginId].extensions.addedFunctions = [functionConfig];

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider
        meta={{
          ...pluginMeta,
          // The module tells if it is a core plugin
          module: 'core:plugin/traces',
          extensions: {
            ...pluginMeta.extensions!,
            // Empty list of extension points in the plugin meta (from plugin.json)
            extensionPoints: [],
          },
        }}
      >
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );

    registries.addedFunctionsRegistry.register({
      pluginId,
      configs: [functionConfig],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    // (No restrictions due to being a core plugin)
    const { result } = renderHook(() => usePluginFunctions({ extensionPointId }), { wrapper });
    expect(result.current.functions.length).toBe(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should not validate the extension point id in production mode', () => {
    // Empty list of extension points in the plugin meta (from plugin.json)
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider
        meta={{
          ...pluginMeta,
          extensions: {
            ...pluginMeta.extensions!,
            extensionPoints: [],
          },
        }}
      >
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );

    // Trying to render an extension point that is not defined in the plugin meta
    // (No restrictions due to isGrafanaDevMode() = false)
    const { result } = renderHook(() => usePluginFunctions({ extensionPointId: 'invalid-extension-point-id' }), {
      wrapper,
    });
    expect(result.current.functions.length).toBe(0);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should not validate the extension point meta-info if used in Grafana core (no plugin context)', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // No plugin context -> used in Grafana core
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );

    // Adding an extension to the extension point
    registries.addedFunctionsRegistry.register({
      pluginId: 'grafana', // Only core Grafana can register extensions without a plugin context
      configs: [
        {
          targets: PluginExtensionPoints.DashboardPanelMenu,
          title: '1',
          description: '1',
          fn: () => 'function1',
        },
      ],
    });

    const { result } = renderHook(
      () => usePluginFunctions({ extensionPointId: PluginExtensionPoints.DashboardPanelMenu }),
      {
        wrapper,
      }
    );
    expect(result.current.functions.length).toBe(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should not allow to create an extension point in core Grafana that is not exposed to plugins', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // No plugin context -> used in Grafana core
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );

    const extensionPointId = 'grafana/not-exposed-extension-point/v1';

    // Adding an extension to the extension point
    registries.addedFunctionsRegistry.register({
      pluginId: 'grafana', // Only core Grafana can register extensions without a plugin context
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          fn: () => 'function1',
        },
      ],
    });

    const { result } = renderHook(() => usePluginFunctions({ extensionPointId }), { wrapper });
    expect(result.current.functions.length).toBe(0);
    expect(log.error).toHaveBeenCalled();
  });

  it('should not validate the extension point id if used in Grafana core (no plugin context)', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // No plugin context -> used in Grafana core
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );

    const { result } = renderHook(() => usePluginFunctions({ extensionPointId: 'invalid-extension-point-id' }), {
      wrapper,
    });
    expect(result.current.functions.length).toBe(0);
    expect(log.warning).not.toHaveBeenCalled();
  });

  it('should validate if the extension point meta-info is correct if in dev-mode and used by a plugin', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // Empty list of extension points in the plugin meta (from plugin.json)
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider
        meta={{
          ...pluginMeta,
          extensions: {
            ...pluginMeta.extensions!,
            extensionPoints: [],
          },
        }}
      >
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );

    // Adding an extension to the extension point - it should not be returned later
    registries.addedFunctionsRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          fn: () => 'function1',
        },
      ],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    const { result } = renderHook(() => usePluginFunctions({ extensionPointId }), { wrapper });
    expect(result.current.functions.length).toBe(0);
    expect(log.error).toHaveBeenCalled();
  });
});
