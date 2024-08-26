import { act, render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import { ExposedComponentsRegistry } from './registry/ExposedComponentsRegistry';
import { createUsePluginComponent } from './usePluginComponent';

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
  let registry: ExposedComponentsRegistry;

  beforeEach(() => {
    registry = new ExposedComponentsRegistry();
  });

  it('should return null if there are no component exposed for the id', () => {
    const usePluginComponent = createUsePluginComponent(registry);
    const { result } = renderHook(() => usePluginComponent('foo/bar'));

    expect(result.current.component).toEqual(null);
    expect(result.current.isLoading).toEqual(false);
  });

  it('should return component, that can be rendered, from the registry', async () => {
    const id = 'my-app-plugin/foo/bar/v1';
    const pluginId = 'my-app-plugin';

    registry.register({
      pluginId,
      configs: [{ id, title: 'not important', description: 'not important', component: () => <div>Hello World</div> }],
    });

    const usePluginComponent = createUsePluginComponent(registry);
    const { result } = renderHook(() => usePluginComponent(id));
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
    const usePluginComponent = createUsePluginComponent(registry);
    const { result, rerender } = renderHook(() => usePluginComponent(id));

    // No extensions yet
    expect(result.current.component).toBeNull();
    expect(result.current.isLoading).toEqual(false);

    // Add extensions to the registry
    act(() => {
      registry.register({
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

  it('should only render the hook once', () => {
    const spy = jest.spyOn(registry, 'asObservable');
    const id = 'my-app-plugin/foo/bar';
    const usePluginComponent = createUsePluginComponent(registry);

    renderHook(() => usePluginComponent(id));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
