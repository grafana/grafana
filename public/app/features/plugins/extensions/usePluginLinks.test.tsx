import { act, render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { createUsePluginLinks } from './usePluginLinks';

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

describe('usePluginLinks()', () => {
  let registry: AddedLinksRegistry;

  beforeEach(() => {
    registry = new AddedLinksRegistry();
  });

  it('should return an empty array if there are no extensions registered for the extension point', () => {
    const usePluginComponents = createUsePluginLinks(registry);
    const { result } = renderHook(() =>
      usePluginComponents({
        extensionPointId: 'foo/bar',
      })
    );

    expect(result.current.links).toEqual([]);
  });

  it('should only return the plugin extension components for the given extension point ids', async () => {
    const extensionPointId = 'plugins/foo/bar/v1';
    const pluginId = 'my-app-plugin';

    registry.register({
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

    const usePluginComponents = createUsePluginLinks(registry);
    const { result } = renderHook(() => usePluginComponents({ extensionPointId }));

    expect(result.current.links.length).toBe(2);

    act(() => {
      render(result.current.links.map((Component, index) => <Component key={index} />));
    });
    expect(await screen.findByText('Hello World1')).toBeVisible();
    expect(await screen.findByText('Hello World2')).toBeVisible();
    expect(await screen.queryByText('Hello World3')).toBeNull();
  });

  it('should dynamically update the extensions registered for a certain extension point', () => {
    const extensionPointId = 'plugins/foo/bar/v1';
    const pluginId = 'my-app-plugin';
    const usePluginComponents = createUsePluginLinks(registry);
    let { result, rerender } = renderHook(() => usePluginComponents({ extensionPointId }));

    // No extensions yet
    expect(result.current.links.length).toBe(0);

    // Add extensions to the registry
    act(() => {
      registry.register({
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

    expect(result.current.links.length).toBe(2);
  });

  it('should only render the hook once', () => {
    const spy = jest.spyOn(registry, 'asObservable');
    const extensionPointId = 'plugins/foo/bar';
    const usePluginComponents = createUsePluginLinks(registry);

    renderHook(() => usePluginComponents({ extensionPointId }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should honour the limitPerPlugin arg if its set', () => {
    const extensionPointId = 'plugins/foo/bar/v1';
    const plugins = ['my-app-plugin1', 'my-app-plugin2', 'my-app-plugin3'];
    const usePluginComponents = createUsePluginLinks(registry);
    let { result, rerender } = renderHook(() => usePluginComponents({ extensionPointId, limitPerPlugin: 2 }));

    // No extensions yet
    expect(result.current.links.length).toBe(0);

    // Add extensions to the registry
    act(() => {
      for (let pluginId of plugins) {
        registry.register({
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

    expect(result.current.links.length).toBe(6);
  });
});
