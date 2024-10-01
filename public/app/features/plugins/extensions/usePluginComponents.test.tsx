import { act, render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import { ExtensionRegistriesProvider } from './ExtensionRegistriesContext';
import { setupPluginExtensionRegistries } from './registry/setup';
import { PluginExtensionRegistries } from './registry/types';
import { usePluginComponents } from './usePluginComponents';
import * as utils from './utils';

const wrapWithPluginContext = jest.spyOn(utils, 'wrapWithPluginContext');

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

describe('usePluginComponents()', () => {
  let registries: PluginExtensionRegistries;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;

  beforeEach(() => {
    registries = setupPluginExtensionRegistries();

    wrapWithPluginContext.mockClear();

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
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
    const extensionPointId = 'plugins/foo/bar/v1';
    const pluginId = 'my-app-plugin';

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
    expect(await screen.queryByText('Hello World3')).toBeNull();
  });

  it('should dynamically update the extensions registered for a certain extension point', () => {
    const extensionPointId = 'plugins/foo/bar/v1';
    const pluginId = 'my-app-plugin';
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
    const extensionPointId = 'plugins/foo/bar/v1';
    const plugins = ['my-app-plugin1', 'my-app-plugin2', 'my-app-plugin3'];
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
              targets: extensionPointId,
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
});
