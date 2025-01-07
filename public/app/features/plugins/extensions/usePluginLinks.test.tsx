import { act, renderHook } from '@testing-library/react';

import { PluginContextProvider, PluginMeta, PluginType } from '@grafana/data';

import { ExtensionRegistriesProvider } from './ExtensionRegistriesContext';
import { log } from './logs/log';
import { resetLogMock } from './logs/testUtils';
import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from './registry/ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './registry/types';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { usePluginLinks } from './usePluginLinks';
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
  // (to make sure that by default we are testing a production scneario)
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

describe('usePluginLinks()', () => {
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

  it('should return an empty array if there are no link extensions registered for the extension point', () => {
    const { result } = renderHook(
      () =>
        usePluginLinks({
          extensionPointId: 'foo/bar',
        }),
      { wrapper }
    );

    expect(result.current.links).toEqual([]);
  });

  it('should only return the link extensions for the given extension point ids', async () => {
    registries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          path: `/a/${pluginId}/2`,
        },
        {
          targets: extensionPointId,
          title: '2',
          description: '2',
          path: `/a/${pluginId}/2`,
        },
        {
          targets: 'plugins/another-extension/v1',
          title: '3',
          description: '3',
          path: `/a/${pluginId}/3`,
        },
      ],
    });

    const { result } = renderHook(() => usePluginLinks({ extensionPointId }), { wrapper });

    expect(result.current.links.length).toBe(2);
    expect(result.current.links[0].title).toBe('1');
    expect(result.current.links[1].title).toBe('2');
  });

  it('should dynamically update the extensions registered for a certain extension point', () => {
    let { result, rerender } = renderHook(() => usePluginLinks({ extensionPointId }), { wrapper });

    // No extensions yet
    expect(result.current.links.length).toBe(0);

    // Add extensions to the registry
    act(() => {
      registries.addedLinksRegistry.register({
        pluginId,
        configs: [
          {
            targets: extensionPointId,
            title: '1',
            description: '1',
            path: `/a/${pluginId}/2`,
          },
          {
            targets: extensionPointId,
            title: '2',
            description: '2',
            path: `/a/${pluginId}/2`,
          },
        ],
      });
    });

    // Check if the hook returns the new extensions
    rerender();

    expect(result.current.links.length).toBe(2);
    expect(result.current.links[0].title).toBe('1');
    expect(result.current.links[1].title).toBe('2');
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

    registries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          path: `/a/${pluginId}/2`,
        },
      ],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    // (No restrictions due to isGrafanaDevMode() = false)
    let { result } = renderHook(() => usePluginLinks({ extensionPointId }), { wrapper });
    expect(result.current.links.length).toBe(1);
    expect(log.warning).not.toHaveBeenCalled();
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
    let { result } = renderHook(() => usePluginLinks({ extensionPointId: 'invalid-extension-point-id' }), { wrapper });
    expect(result.current.links.length).toBe(0);
    expect(log.warning).not.toHaveBeenCalled();
  });

  it('should not validate the extension point meta-info if used in Grafana core (no plugin context)', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // No plugin context -> used in Grafana core
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );

    // Adding an extension to the extension point
    registries.addedLinksRegistry.register({
      pluginId: 'grafana', // Only core Grafana can register extensions without a plugin context
      configs: [
        {
          targets: 'grafana/extension-point/v1',
          title: '1',
          description: '1',
          path: `/a/grafana/${pluginId}/2`,
        },
      ],
    });

    let { result } = renderHook(() => usePluginLinks({ extensionPointId: 'grafana/extension-point/v1' }), { wrapper });
    expect(result.current.links.length).toBe(1);
    expect(log.warning).not.toHaveBeenCalled();
  });

  it('should not validate the extension point id if used in Grafana core (no plugin context)', () => {
    // Imitate running in dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    // No plugin context -> used in Grafana core
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );

    let { result } = renderHook(() => usePluginLinks({ extensionPointId: 'invalid-extension-point-id' }), { wrapper });
    expect(result.current.links.length).toBe(0);
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
    registries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          path: `/a/${pluginId}/2`,
        },
      ],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    let { result } = renderHook(() => usePluginLinks({ extensionPointId }), { wrapper });
    expect(result.current.links.length).toBe(0);
    expect(log.error).toHaveBeenCalled();
  });

  it('should not log a warning if the extension point meta-info is correct if in dev-mode and used by a plugin', () => {
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
    registries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          targets: extensionPointId,
          title: '1',
          description: '1',
          path: `/a/${pluginId}/2`,
        },
      ],
    });

    // Trying to render an extension point that is not defined in the plugin meta
    let { result } = renderHook(() => usePluginLinks({ extensionPointId }), { wrapper });
    expect(result.current.links.length).toBe(0);
    expect(log.error).toHaveBeenCalled();
  });
});
