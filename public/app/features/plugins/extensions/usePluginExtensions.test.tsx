import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import { PluginExtensionTypes } from '@grafana/data';

import { ReactivePluginExtensionsRegistry } from './reactivePluginExtensionRegistry';
import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { createUsePluginExtensions } from './usePluginExtensions';

describe('usePluginExtensions()', () => {
  let reactiveRegistry: ReactivePluginExtensionsRegistry;
  let addedComponentsRegistry: AddedComponentsRegistry;

  beforeEach(() => {
    reactiveRegistry = new ReactivePluginExtensionsRegistry();
    addedComponentsRegistry = new AddedComponentsRegistry();
  });

  it('should return an empty array if there are no extensions registered for the extension point', () => {
    const usePluginExtensions = createUsePluginExtensions(reactiveRegistry, addedComponentsRegistry);
    const { result } = renderHook(() =>
      usePluginExtensions({
        extensionPointId: 'foo/bar',
      })
    );

    expect(result.current.extensions).toEqual([]);
  });

  it('should return the plugin link extensions from the registry', () => {
    const extensionPointId = 'plugins/foo/bar';
    const pluginId = 'my-app-plugin';

    reactiveRegistry.register({
      pluginId,
      extensionConfigs: [
        {
          type: PluginExtensionTypes.link,
          extensionPointId,
          title: '1',
          description: '1',
          path: `/a/${pluginId}/2`,
        },
        {
          type: PluginExtensionTypes.link,
          extensionPointId,
          title: '2',
          description: '2',
          path: `/a/${pluginId}/2`,
        },
      ],
      exposedComponentConfigs: [],
      addedComponentConfigs: [],
    });

    const usePluginExtensions = createUsePluginExtensions(reactiveRegistry, addedComponentsRegistry);
    const { result } = renderHook(() => usePluginExtensions({ extensionPointId }));

    expect(result.current.extensions.length).toBe(2);
    expect(result.current.extensions[0].title).toBe('1');
    expect(result.current.extensions[1].title).toBe('2');
  });

  it('should return the plugin component extensions from the registry', () => {
    const linkExtensionPointId = 'plugins/foo/bar';
    const componentExtensionPointId = 'plugins/component/bar/v1';
    const pluginId = 'my-app-plugin';

    reactiveRegistry.register({
      pluginId,
      extensionConfigs: [
        {
          type: PluginExtensionTypes.link,
          extensionPointId: linkExtensionPointId,
          title: '1',
          description: '1',
          path: `/a/${pluginId}/2`,
        },
        {
          type: PluginExtensionTypes.link,
          extensionPointId: linkExtensionPointId,
          title: '2',
          description: '2',
          path: `/a/${pluginId}/2`,
        },
      ],
      exposedComponentConfigs: [],
      addedComponentConfigs: [],
    });

    addedComponentsRegistry.register({
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

    const usePluginExtensions = createUsePluginExtensions(reactiveRegistry, addedComponentsRegistry);
    const { result } = renderHook(() => usePluginExtensions({ extensionPointId: componentExtensionPointId }));

    expect(result.current.extensions.length).toBe(2);
    expect(result.current.extensions[0].title).toBe('Component 1');
    expect(result.current.extensions[1].title).toBe('Component 2');
  });

  it('should dynamically update the extensions registered for a certain extension point', () => {
    const extensionPointId = 'plugins/foo/bar';
    const pluginId = 'my-app-plugin';
    const usePluginExtensions = createUsePluginExtensions(reactiveRegistry, addedComponentsRegistry);
    let { result, rerender } = renderHook(() => usePluginExtensions({ extensionPointId }));

    // No extensions yet
    expect(result.current.extensions.length).toBe(0);

    // Add extensions to the registry
    act(() => {
      reactiveRegistry.register({
        pluginId,
        extensionConfigs: [
          {
            type: PluginExtensionTypes.link,
            extensionPointId,
            title: '1',
            description: '1',
            path: `/a/${pluginId}/2`,
          },
          {
            type: PluginExtensionTypes.link,
            extensionPointId,
            title: '2',
            description: '2',
            path: `/a/${pluginId}/2`,
          },
        ],
        exposedComponentConfigs: [],
        addedComponentConfigs: [],
      });
    });

    // Check if the hook returns the new extensions
    rerender();

    expect(result.current.extensions.length).toBe(2);
    expect(result.current.extensions[0].title).toBe('1');
    expect(result.current.extensions[1].title).toBe('2');
  });

  it('should only render the hook once', () => {
    const spy = jest.spyOn(reactiveRegistry, 'asObservable');
    const extensionPointId = 'plugins/foo/bar';
    const usePluginExtensions = createUsePluginExtensions(reactiveRegistry, addedComponentsRegistry);

    renderHook(() => usePluginExtensions({ extensionPointId }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should return the same extensions object if the context object is the same', () => {
    const extensionPointId = 'plugins/foo/bar';
    const pluginId = 'my-app-plugin';
    const usePluginExtensions = createUsePluginExtensions(reactiveRegistry, addedComponentsRegistry);

    // Add extensions to the registry
    act(() => {
      reactiveRegistry.register({
        pluginId,
        extensionConfigs: [
          {
            type: PluginExtensionTypes.link,
            extensionPointId,
            title: '1',
            description: '1',
            path: `/a/${pluginId}/2`,
          },
          {
            type: PluginExtensionTypes.link,
            extensionPointId,
            title: '2',
            description: '2',
            path: `/a/${pluginId}/2`,
          },
        ],
        exposedComponentConfigs: [],
        addedComponentConfigs: [],
      });
    });

    // Check if it returns the same extensions object in case nothing changes
    const context = {};
    const firstResults = renderHook(() => usePluginExtensions({ extensionPointId, context }));
    const secondResults = renderHook(() => usePluginExtensions({ extensionPointId, context }));
    expect(firstResults.result.current.extensions === secondResults.result.current.extensions).toBe(true);
  });

  it('should return a new extensions object if the context object is different', () => {
    const extensionPointId = 'plugins/foo/bar';
    const pluginId = 'my-app-plugin';
    const usePluginExtensions = createUsePluginExtensions(reactiveRegistry, addedComponentsRegistry);

    // Add extensions to the registry
    act(() => {
      reactiveRegistry.register({
        pluginId,
        extensionConfigs: [
          {
            type: PluginExtensionTypes.link,
            extensionPointId,
            title: '1',
            description: '1',
            path: `/a/${pluginId}/2`,
          },
          {
            type: PluginExtensionTypes.link,
            extensionPointId,
            title: '2',
            description: '2',
            path: `/a/${pluginId}/2`,
          },
        ],
        exposedComponentConfigs: [],
        addedComponentConfigs: [],
      });
    });

    // Check if it returns a different extensions object in case the context object changes
    const firstResults = renderHook(() => usePluginExtensions({ extensionPointId, context: {} }));
    const secondResults = renderHook(() => usePluginExtensions({ extensionPointId, context: {} }));
    expect(firstResults.result.current.extensions === secondResults.result.current.extensions).toBe(false);
  });

  it('should return a new extensions object if the registry changes but the context object is the same', () => {
    const extensionPointId = 'plugins/foo/bar';
    const pluginId = 'my-app-plugin';
    const context = {};
    const usePluginExtensions = createUsePluginExtensions(reactiveRegistry, addedComponentsRegistry);

    // Add the first extension
    act(() => {
      reactiveRegistry.register({
        pluginId,
        extensionConfigs: [
          {
            type: PluginExtensionTypes.link,
            extensionPointId,
            title: '1',
            description: '1',
            path: `/a/${pluginId}/2`,
          },
        ],
        exposedComponentConfigs: [],
        addedComponentConfigs: [],
      });
    });

    const { result, rerender } = renderHook(() => usePluginExtensions({ extensionPointId, context }));
    const firstExtensions = result.current.extensions;

    // Add the second extension
    act(() => {
      reactiveRegistry.register({
        pluginId,
        extensionConfigs: [
          {
            type: PluginExtensionTypes.link,
            extensionPointId,
            // extensionPointId: 'plugins/foo/bar/zed', // A different extension point (to be sure that it's also returning a new object when the actual extension point doesn't change)
            title: '2',
            description: '2',
            path: `/a/${pluginId}/2`,
          },
        ],
        exposedComponentConfigs: [],
        addedComponentConfigs: [],
      });
    });

    rerender();

    const secondExtensions = result.current.extensions;

    expect(firstExtensions === secondExtensions).toBe(false);
  });
});
