import { act, render, renderHook, screen } from '@testing-library/react';

import { PluginContextProvider, PluginMeta, PluginType } from '@grafana/data';

import { ExtensionRegistriesProvider } from './ExtensionRegistriesContext';
import { log } from './logs/log';
import { resetLogMock } from './logs/testUtils';
import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from './registry/ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './registry/types';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { usePluginComponents } from './usePluginComponents';
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

describe('usePluginComponents()', () => {
  let registries: PluginExtensionRegistries;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;
  let pluginMeta: PluginMeta;
  const pluginId = 'myorg-extensions-app';
  const extensionPointId = `${pluginId}/extension-point/v1`;

  beforeEach(() => {
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);
    jest.mocked(useLoadAppPlugins).mockReturnValue({ isLoading: false });

    resetLogMock(log);
    registries = {
      addedComponentsRegistry: new AddedComponentsRegistry(),
      exposedComponentsRegistry: new ExposedComponentsRegistry(),
      addedLinksRegistry: new AddedLinksRegistry(),
    };

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
      },
      dependencies: {
        grafanaVersion: '8.0.0',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
    };

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider meta={pluginMeta}>
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );
  });

  it('should return an empty array if there are no extensions registered for the extension point', () => {
    const { result } = renderHook(
      () =>
        usePluginComponents({
          extensionPointId: 'foo/bar',
        }),
      { wrapper }
    );

    expect(result.current.components).toEqual([]);
  });

  it('should only return the plugin extension components for the given extension point ids', async () => {
    registries.addedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          component: () => <div>Hello World1</div>,
        },
        {
          targets: extensionPointId,
          title: '2',
          description: '2',
          component: () => <div>Hello World2</div>,
        },
        {
          targets: 'plugins/another-extension/v1',
          title: '3',
          description: '3',
          component: () => <div>Hello World3</div>,
        },
      ],
    });

    const { result } = renderHook(() => usePluginComponents({ extensionPointId }), { wrapper });

    expect(result.current.components.length).toBe(2);

    act(() => {
      render(result.current.components.map((Component, index) => <Component key={index} />));
    });

    expect(await screen.findByText('Hello World1')).toBeVisible();
    expect(await screen.findByText('Hello World2')).toBeVisible();
    expect(screen.queryByText('Hello World3')).toBeNull();
  });

  it('should dynamically update the extensions registered for a certain extension point', () => {
    let { result, rerender } = renderHook(() => usePluginComponents({ extensionPointId }), { wrapper });

    // No extensions yet
    expect(result.current.components.length).toBe(0);

    // Add extensions to the registry
    act(() => {
      registries.addedComponentsRegistry.register({
        pluginId,
        configs: [
          {
            targets: extensionPointId,
            title: '1',
            description: '1',
            component: () => <div>Hello World1</div>,
          },
          {
            targets: extensionPointId,
            title: '2',
            description: '2',
            component: () => <div>Hello World2</div>,
          },
          {
            targets: 'plugins/another-extension/v1',
            title: '3',
            description: '3',
            component: () => <div>Hello World3</div>,
          },
        ],
      });
    });

    // Check if the hook returns the new extensions
    rerender();

    expect(result.current.components.length).toBe(2);
  });

  it('should honour the limitPerPlugin arg if its set', () => {
    const plugins = ['my-awesome1-app', 'my-awesome2-app', 'my-awesome3-app'];
    let { result, rerender } = renderHook(() => usePluginComponents({ extensionPointId, limitPerPlugin: 2 }), {
      wrapper,
    });

    // No extensions yet
    expect(result.current.components.length).toBe(0);

    // Add extensions to the registry
    act(() => {
      for (let pluginId of plugins) {
        registries.addedComponentsRegistry.register({
          pluginId,
          configs: [
            {
              targets: [extensionPointId],
              title: '1',
              description: '1',
              component: () => <div>Hello World1</div>,
            },
            {
              targets: [extensionPointId],
              title: '2',
              description: '2',
              component: () => <div>Hello World2</div>,
            },
            {
              targets: [extensionPointId],
              title: '3',
              description: '3',
              component: () => <div>Hello World3</div>,
            },
          ],
        });
      }
    });

    // Check if the hook returns the new extensions
    rerender();

    expect(result.current.components.length).toBe(6);
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

    registries.addedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          component: () => <div>Component</div>,
        },
      ],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    // (No restrictions due to isGrafanaDevMode() = false)
    let { result } = renderHook(() => usePluginComponents({ extensionPointId }), { wrapper });
    expect(result.current.components.length).toBe(1);
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
    let { result } = renderHook(() => usePluginComponents({ extensionPointId: 'invalid-extension-point-id' }), {
      wrapper,
    });
    expect(result.current.components.length).toBe(0);
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
    registries.addedComponentsRegistry.register({
      pluginId: 'grafana', // Only core Grafana can register extensions without a plugin context
      configs: [
        {
          targets: 'grafana/extension-point/v1',
          title: '1',
          description: '1',
          component: () => <div>Component</div>,
        },
      ],
    });

    let { result } = renderHook(() => usePluginComponents({ extensionPointId: 'grafana/extension-point/v1' }), {
      wrapper,
    });
    expect(result.current.components.length).toBe(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should not validate the extension point id if used in Grafana core (no plugin context)', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // No plugin context -> used in Grafana core
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );

    let { result } = renderHook(() => usePluginComponents({ extensionPointId: 'invalid-extension-point-id' }), {
      wrapper,
    });
    expect(result.current.components.length).toBe(0);
    expect(log.error).not.toHaveBeenCalled();
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
    registries.addedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          component: () => <div>Component</div>,
        },
      ],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    let { result } = renderHook(() => usePluginComponents({ extensionPointId }), { wrapper });
    expect(result.current.components.length).toBe(0);
    expect(log.error).toHaveBeenCalled();
  });

  it('should not log an error if the extension point meta-info is correct if in dev-mode and used by a plugin', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // The extension point is listed in the plugin meta (from plugin.json)
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginContextProvider
        meta={{
          ...pluginMeta,
          extensions: {
            ...pluginMeta.extensions!,
            extensionPoints: [
              {
                id: extensionPointId,
                title: 'Extension point',
                description: 'Extension point description',
              },
            ],
          },
        }}
      >
        <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
      </PluginContextProvider>
    );

    // Adding an extension to the extension point - it should not be returned later
    registries.addedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          component: () => <div>Component</div>,
        },
      ],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    let { result } = renderHook(() => usePluginComponents({ extensionPointId }), { wrapper });
    expect(result.current.components.length).toBe(0);
    expect(log.error).toHaveBeenCalled();
  });
});
