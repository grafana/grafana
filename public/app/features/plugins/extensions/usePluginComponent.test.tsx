import { act, render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import { ExtensionRegistriesProvider } from './ExtensionRegistriesContext';
import { setupPluginExtensionRegistries } from './registry/setup';
import { PluginExtensionRegistries } from './registry/types';
import { usePluginComponent } from './usePluginComponent';
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

describe('usePluginComponent()', () => {
  let registries: PluginExtensionRegistries;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;

  beforeEach(() => {
    registries = setupPluginExtensionRegistries();

    wrapWithPluginContext.mockClear();

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );
  });

  it('should return null if there are no component exposed for the id', () => {
    const { result } = renderHook(() => usePluginComponent('foo/bar'), { wrapper });

    expect(result.current.component).toEqual(null);
    expect(result.current.isLoading).toEqual(false);
  });

  it('should return component, that can be rendered, from the registry', async () => {
    const id = 'my-app-plugin/foo/bar/v1';
    const pluginId = 'my-app-plugin';

    registries.exposedComponentsRegistry.register({
      pluginId,
      configs: [{ id, title: 'not important', description: 'not important', component: () => <div>Hello World</div> }],
    });

    const { result } = renderHook(() => usePluginComponent(id), { wrapper });
    const Component = result.current.component;

    act(() => {
      render(Component && <Component />);
    });

    expect(result.current.isLoading).toEqual(false);
    expect(result.current.component).not.toBeNull();
    expect(await screen.findByText('Hello World')).toBeVisible();
  });

  it('should dynamically update when component is registered to the registry', async () => {
    const id = 'my-app-plugin/foo/bar/v1';
    const pluginId = 'my-app-plugin';
    const { result, rerender } = renderHook(() => usePluginComponent(id), { wrapper });

    // No extensions yet
    expect(result.current.component).toBeNull();
    expect(result.current.isLoading).toEqual(false);

    // Add extensions to the registry
    act(() => {
      registries.exposedComponentsRegistry.register({
        pluginId,
        configs: [
          {
            id,
            title: 'not important',
            description: 'not important',
            component: () => <div>Hello World</div>,
          },
        ],
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
    const pluginId = 'my-app-plugin';
    const id = `${pluginId}/foo/v1`;

    // Add extensions to the registry
    act(() => {
      registries.exposedComponentsRegistry.register({
        pluginId,
        configs: [
          {
            id,
            title: 'not important',
            description: 'not important',
            component: () => <div>Hello World</div>,
          },
        ],
      });
    });

    expect(wrapWithPluginContext).toHaveBeenCalledTimes(0);
    renderHook(() => usePluginComponent(id), { wrapper });
    await waitFor(() => expect(wrapWithPluginContext).toHaveBeenCalledTimes(1));
  });
});
