import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import { PluginExtensionTypes } from '@grafana/data';

import { ReactivePluginExtensionsRegistry } from './reactivePluginExtensionRegistry';
import { createPluginExtensionsHook } from './usePluginExtensions';

describe('usePluginExtensions()', () => {
  let reactiveRegistry: ReactivePluginExtensionsRegistry;

  beforeEach(() => {
    reactiveRegistry = new ReactivePluginExtensionsRegistry();
  });

  it('should return an empty array if there are no extensions registered for the extension point', () => {
    const usePluginExtensions = createPluginExtensionsHook(reactiveRegistry);
    const { result } = renderHook(() =>
      usePluginExtensions({
        extensionPointId: 'foo/bar',
      })
    );

    expect(result.current.extensions).toEqual([]);
  });

  it('should return the plugin extensions from the registry', () => {
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
    });

    const usePluginExtensions = createPluginExtensionsHook(reactiveRegistry);
    const { result } = renderHook(() => usePluginExtensions({ extensionPointId }));

    expect(result.current.extensions.length).toBe(2);
    expect(result.current.extensions[0].title).toBe('1');
    expect(result.current.extensions[1].title).toBe('2');
  });

  it('should dynamically update the extensions registered for a certain extension point', () => {
    const extensionPointId = 'plugins/foo/bar';
    const pluginId = 'my-app-plugin';
    const usePluginExtensions = createPluginExtensionsHook(reactiveRegistry);
    let hookRender = renderHook(() => usePluginExtensions({ extensionPointId }));

    // No extensions yet
    expect(hookRender.result.current.extensions.length).toBe(0);

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
      });
    });

    // Check if the hook returns the new extensions
    hookRender = renderHook(() => usePluginExtensions({ extensionPointId }));
    expect(hookRender.result.current.extensions.length).toBe(2);
    expect(hookRender.result.current.extensions[0].title).toBe('1');
    expect(hookRender.result.current.extensions[1].title).toBe('2');
  });
});
