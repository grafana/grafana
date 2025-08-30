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
import { UrlRecognizersRegistry } from './registry/UrlRecognizersRegistry';
import { PluginExtensionRegistries } from './registry/types';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { usePluginComponent } from './usePluginComponent';
import { isGrafanaDevMode } from './utils';

jest.mock('./useLoadAppPlugins');
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),

  // Manually set the dev mode to false
  // (to make sure that by default we are testing a production scneario)
  isGrafanaDevMode: jest.fn().mockReturnValue(false),
}));

// See: public/app/features/plugins/extensions/utils.tsx for implementation details
jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useAsync: jest.fn().mockImplementation(() => ({
    error: null,
    loading: false,
    value: {
      id: 'my-app-plugin',
    },
  })),
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
      urlRecognizersRegistry: new UrlRecognizersRegistry(),
    };
    jest.mocked(useLoadAppPlugins).mockReturnValue({ isLoading: false });
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);
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

    jest.mocked(isGrafanaDevMode).mockClear();
    expect(isGrafanaDevMode).toHaveBeenCalledTimes(0);
    renderHook(() => usePluginComponent(exposedComponentId), { wrapper });
    // The registryState is undefined in the first render, so the isGrafanaDevMode() is called twice
    await waitFor(() => expect(isGrafanaDevMode).toHaveBeenCalledTimes(2));
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

  it('should pass a writable copy of the props (in dev mode)', async () => {
    config.buildInfo.env = 'development';

    type Props = {
      a: {
        b: {
          c: string;
        };
      };
      override?: boolean;
    };

    registries.exposedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          ...exposedComponentConfig,
          // @ts-expect-error - The registry shouldn't be used this way
          component: (props: Props) => {
            if (props.override) {
              props.a.b.c = 'baz';
            }

            return <span>Foo</span>;
          },
        },
      ],
    });

    const originalProps = {
      a: {
        b: {
          c: 'bar',
        },
      },
    };

    const { result } = renderHook(() => usePluginComponent<Props>(exposedComponentId), { wrapper });
    const Component = result.current.component;

    // Should render normally if it doesn't mutate the props
    const rendered = render(Component && <Component {...originalProps} />);
    expect(rendered.getByText('Foo')).toBeVisible();

    // Should not throw an error if it mutates the props
    expect(() => render(Component && <Component {...originalProps} override />)).not.toThrow();

    // Should log an error in dev mode
    expect(log.error).toHaveBeenCalledWith(
      'Attempted to mutate object property "c" from extension with id myorg-extensions-app and version unknown',
      {
        stack: expect.any(String),
      }
    );
  });

  it('should pass a writable copy of the props (in production mode)', async () => {
    config.buildInfo.env = 'production';

    type Props = {
      a: {
        b: {
          c: string;
        };
      };
      override?: boolean;
    };

    registries.exposedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          ...exposedComponentConfig,
          // @ts-expect-error - The registry shouldn't be used this way
          component: (props: Props) => {
            if (props.override) {
              props.a.b.c = 'baz';
            }

            return <span>Foo</span>;
          },
        },
      ],
    });

    const originalProps = {
      a: {
        b: {
          c: 'bar',
        },
      },
    };

    const { result } = renderHook(() => usePluginComponent<Props>(exposedComponentId), { wrapper });
    const Component = result.current.component;

    // Should render normally if it doesn't mutate the props
    const rendered = render(Component && <Component {...originalProps} />);
    expect(rendered.getByText('Foo')).toBeVisible();

    // Should not throw an error if it mutates the props
    expect(() => render(Component && <Component {...originalProps} override />)).not.toThrow();

    // Should log a warning
    expect(log.warning).toHaveBeenCalledWith(
      'Attempted to mutate object property "c" from extension with id myorg-extensions-app and version unknown',
      {
        stack: expect.any(String),
      }
    );
  });
});
