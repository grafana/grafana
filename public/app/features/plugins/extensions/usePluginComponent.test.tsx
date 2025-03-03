import { act, render, renderHook, screen, waitFor } from '@testing-library/react';

import { PluginContextProvider, PluginLoadingStrategy, PluginMeta, PluginType } from '@grafana/data';
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
import { usePluginComponent } from './usePluginComponent';
import { isGrafanaDevMode, wrapWithPluginContext } from './utils';

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
  // (to make sure that by default we are testing a production scneario)
  isGrafanaDevMode: jest.fn().mockReturnValue(false),
  wrapWithPluginContext: jest.fn().mockImplementation((_, component: React.ReactNode) => component),
}));

jest.mock('./logs/log', () => {
  const { createLogMock } = jest.requireActual('./logs/testUtils');
  const original = jest.requireActual('./logs/log');

  return {
    ...original,
    log: createLogMock(),
  };
});

describe('usePluginComponent()', () => {
  let registries: PluginExtensionRegistries;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;
  let pluginMeta: PluginMeta;
  const originalApps = config.apps;
  const pluginId = 'myorg-extensions-app';
  const exposedComponentId = `${pluginId}/exposed-component/v1`;
  const exposedComponentConfig = {
    id: exposedComponentId,
    title: 'Exposed component',
    description: 'Exposed component description',
    component: () => <div>Hello World</div>,
  };
  const appPluginConfig = {
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
      // This is necessary, so we can register exposed components to the registry during the tests
      // (Otherwise the registry would reject it in the imitated production mode)
      exposedComponents: [exposedComponentConfig],
      extensionPoints: [],
    },
  };

  beforeEach(() => {
    registries = {
      addedComponentsRegistry: new AddedComponentsRegistry(),
      exposedComponentsRegistry: new ExposedComponentsRegistry(),
      addedLinksRegistry: new AddedLinksRegistry(),
      addedFunctionsRegistry: new AddedFunctionsRegistry(),
    };
    jest.mocked(useLoadAppPlugins).mockReturnValue({ isLoading: false });
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);
    resetLogMock(log);

    jest.mocked(wrapWithPluginContext).mockClear();

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

    config.apps = {
      [pluginId]: appPluginConfig,
    };

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );
  });

  afterEach(() => {
    config.apps = originalApps;
  });

  it('should return null if there are no component exposed for the id', () => {
    const { result } = renderHook(() => usePluginComponent('foo/bar'), { wrapper });

    expect(result.current.component).toEqual(null);
    expect(result.current.isLoading).toEqual(false);
  });

  it('should return component, that can be rendered, from the registry', async () => {
    registries.exposedComponentsRegistry.register({
      pluginId,
      configs: [exposedComponentConfig],
    });

    const { result } = renderHook(() => usePluginComponent(exposedComponentId), { wrapper });
    const Component = result.current.component;

    act(() => {
      render(Component && <Component />);
    });

    expect(result.current.isLoading).toEqual(false);
    expect(result.current.component).not.toBeNull();
    expect(await screen.findByText('Hello World')).toBeVisible();
  });

  it('should dynamically update when component is registered to the registry', async () => {
    const { result, rerender } = renderHook(() => usePluginComponent(exposedComponentId), { wrapper });

    // No extensions yet
    expect(result.current.component).toBeNull();
    expect(result.current.isLoading).toEqual(false);

    // Add extensions to the registry
    act(() => {
      registries.exposedComponentsRegistry.register({
        pluginId,
        configs: [exposedComponentConfig],
      });
    });

    // Check if the hook returns the new extensions
    rerender();

    const Component = result.current.component;
    expect(result.current.isLoading).toEqual(false);
    expect(result.current.component).not.toBeNull();

    act(() => {
      render(Component && <Component />);
    });

    expect(await screen.findByText('Hello World')).toBeVisible();
  });

  it('should only render the hook once', async () => {
    // Add extensions to the registry
    act(() => {
      registries.exposedComponentsRegistry.register({
        pluginId,
        configs: [exposedComponentConfig],
      });
    });

    expect(wrapWithPluginContext).toHaveBeenCalledTimes(0);
    renderHook(() => usePluginComponent(exposedComponentId), { wrapper });
    await waitFor(() => expect(wrapWithPluginContext).toHaveBeenCalledTimes(1));
  });

  it('should not validate the meta-info in production mode', () => {
    // Empty list of exposed component ids in the plugin meta (from plugin.json)
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider
        meta={{
          ...pluginMeta,
          dependencies: {
            ...pluginMeta.dependencies!,
            extensions: {
              exposedComponents: [],
            },
          },
        }}
      >
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );

    registries.exposedComponentsRegistry.register({
      pluginId,
      configs: [exposedComponentConfig],
    });

    // Trying to render an exposed component that is not defined in the plugin meta
    // (No restrictions due to isGrafanaDevMode() = false)
    let { result } = renderHook(() => usePluginComponent(exposedComponentId), { wrapper });
    expect(result.current.component).not.toBe(null);
    expect(log.warning).not.toHaveBeenCalled();
  });

  it('should not validate the meta-info in core Grafana', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // No plugin context -> used in Grafana core
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );

    registries.exposedComponentsRegistry.register({
      pluginId,
      configs: [exposedComponentConfig],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    // (No restrictions due to isGrafanaDevMode() = false)
    let { result } = renderHook(() => usePluginComponent(exposedComponentId), {
      wrapper,
    });

    expect(result.current.component).not.toBe(null);
    expect(log.warning).not.toHaveBeenCalled();
  });

  it('should validate the meta-info in dev mode and if inside a plugin', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // Empty list of exposed component ids in the plugin meta (from plugin.json)
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider
        meta={{
          ...pluginMeta,
          dependencies: {
            ...pluginMeta.dependencies!,
            extensions: {
              exposedComponents: [],
            },
          },
        }}
      >
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );

    registries.exposedComponentsRegistry.register({
      pluginId,
      configs: [exposedComponentConfig],
    });

    // Shouldn't return the component, as it's not present in the plugin.json dependencies
    let { result } = renderHook(() => usePluginComponent(exposedComponentId), { wrapper });
    expect(result.current.component).toBe(null);
    expect(log.error).toHaveBeenCalled();
  });

  it('should return the exposed component if the meta-info is correct and in dev mode', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider
        meta={{
          ...pluginMeta,
          dependencies: {
            ...pluginMeta.dependencies!,
            extensions: {
              exposedComponents: [exposedComponentId],
            },
          },
        }}
      >
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );

    registries.exposedComponentsRegistry.register({
      pluginId,
      configs: [exposedComponentConfig],
    });

    let { result } = renderHook(() => usePluginComponent(exposedComponentId), { wrapper });
    expect(result.current.component).not.toBe(null);
    expect(log.warning).not.toHaveBeenCalled();
  });
});
