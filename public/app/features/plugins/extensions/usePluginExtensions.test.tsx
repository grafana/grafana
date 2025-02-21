import { act, renderHook } from '@testing-library/react';

import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from './registry/ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './registry/types';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { createUsePluginExtensions } from './usePluginExtensions';

jest.mock('./useLoadAppPlugins');

describe('usePluginExtensions()', () => {
  let registries: PluginExtensionRegistries;
  const pluginId = 'myorg-extensions-app';
  const extensionPointId = `${pluginId}/extension-point/v1`;

  beforeEach(() => {
    registries = {
      addedComponentsRegistry: new AddedComponentsRegistry(),
      addedLinksRegistry: new AddedLinksRegistry(),
      exposedComponentsRegistry: new ExposedComponentsRegistry(),
      addedFunctionsRegistry: new AddedFunctionsRegistry(),
    };
    jest.mocked(useLoadAppPlugins).mockReturnValue({ isLoading: false });
  });

  it('should return an empty array if there are no extensions registered for the extension point', () => {
    const usePluginExtensions = createUsePluginExtensions(registries);
    const { result } = renderHook(() =>
      usePluginExtensions({
        extensionPointId: 'foo/bar/v1',
      })
    );

    expect(result.current.extensions).toEqual([]);
  });

  it('should return the plugin link extensions from the registry', () => {
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

    const usePluginExtensions = createUsePluginExtensions(registries);
    const { result } = renderHook(() => usePluginExtensions({ extensionPointId }));

    expect(result.current.extensions.length).toBe(2);
    expect(result.current.extensions[0].title).toBe('1');
    expect(result.current.extensions[1].title).toBe('2');
  });

  it('should return the plugin component extensions from the registry', () => {
    const componentExtensionPointId = `${pluginId}/component/v1`;

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

    registries.addedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          targets: componentExtensionPointId,
          title: 'Component 1',
          description: '1',
          component: () => <div>Hello World1</div>,
        },
        {
          targets: componentExtensionPointId,
          title: 'Component 2',
          description: '2',
          component: () => <div>Hello World2</div>,
        },
      ],
    });

    const usePluginExtensions = createUsePluginExtensions(registries);
    const { result } = renderHook(() => usePluginExtensions({ extensionPointId: componentExtensionPointId }));

    expect(result.current.extensions.length).toBe(2);
    expect(result.current.extensions[0].title).toBe('Component 1');
    expect(result.current.extensions[1].title).toBe('Component 2');
  });

  it('should dynamically update the extensions registered for a certain extension point', () => {
    const usePluginExtensions = createUsePluginExtensions(registries);
    let { result, rerender } = renderHook(() => usePluginExtensions({ extensionPointId }));

    // No extensions yet
    expect(result.current.extensions.length).toBe(0);

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

    expect(result.current.extensions.length).toBe(2);
    expect(result.current.extensions[0].title).toBe('1');
    expect(result.current.extensions[1].title).toBe('2');
  });

  it('should only render the hook once', () => {
    const addedComponentsRegistrySpy = jest.spyOn(registries.addedComponentsRegistry, 'asObservable');
    const addedLinksRegistrySpy = jest.spyOn(registries.addedLinksRegistry, 'asObservable');
    const usePluginExtensions = createUsePluginExtensions(registries);

    renderHook(() => usePluginExtensions({ extensionPointId }));
    expect(addedComponentsRegistrySpy).toHaveBeenCalledTimes(1);
    expect(addedLinksRegistrySpy).toHaveBeenCalledTimes(1);
  });

  it('should return the same extensions object if the context object is the same', async () => {
    const usePluginExtensions = createUsePluginExtensions(registries);

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

    // Check if it returns the same extensions object in case nothing changes
    const context = {};
    const { rerender, result } = renderHook(usePluginExtensions, {
      initialProps: {
        extensionPointId,
        context,
      },
    });
    const firstResult = result.current;

    rerender({ context, extensionPointId });
    const secondResult = result.current;

    expect(firstResult.extensions).toBe(secondResult.extensions);
  });

  it('should return a new extensions object if the context object is different', () => {
    const usePluginExtensions = createUsePluginExtensions(registries);

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

    // Check if it returns a different extensions object in case the context object changes
    const firstResults = renderHook(() => usePluginExtensions({ extensionPointId, context: {} }));
    const secondResults = renderHook(() => usePluginExtensions({ extensionPointId, context: {} }));
    expect(firstResults.result.current.extensions === secondResults.result.current.extensions).toBe(false);
  });

  it('should return a new extensions object if the registry changes but the context object is the same', () => {
    const context = {};
    const usePluginExtensions = createUsePluginExtensions(registries);

    // Add the first extension
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
        ],
      });
    });

    const { result, rerender } = renderHook(() => usePluginExtensions({ extensionPointId, context }));
    const firstExtensions = result.current.extensions;

    // Add the second extension
    act(() => {
      registries.addedLinksRegistry.register({
        pluginId,
        configs: [
          {
            targets: extensionPointId,
            // extensionPointId: 'plugins/foo/bar/zed', // A different extension point (to be sure that it's also returning a new object when the actual extension point doesn't change)
            title: '2',
            description: '2',
            path: `/a/${pluginId}/2`,
          },
        ],
      });
    });

    rerender();

    const secondExtensions = result.current.extensions;

    expect(firstExtensions === secondExtensions).toBe(false);
  });
});
