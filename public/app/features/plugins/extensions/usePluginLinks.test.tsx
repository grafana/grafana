import { act } from '@testing-library/react';
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

  it('should return an empty array if there are no link extensions registered for the extension point', () => {
    const usePluginComponents = createUsePluginLinks(registry);
    const { result } = renderHook(() =>
      usePluginComponents({
        extensionPointId: 'foo/bar',
      })
    );

    expect(result.current.links).toEqual([]);
  });

  it('should only return the link extensions for the given extension point ids', async () => {
    const extensionPointId = 'plugins/foo/bar/v1';
    const pluginId = 'my-app-plugin';

    registry.register({
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

    const usePluginExtensions = createUsePluginLinks(registry);
    const { result } = renderHook(() => usePluginExtensions({ extensionPointId }));

    expect(result.current.links.length).toBe(2);
    expect(result.current.links[0].title).toBe('1');
    expect(result.current.links[1].title).toBe('2');
  });

  it('should dynamically update the extensions registered for a certain extension point', () => {
    const extensionPointId = 'plugins/foo/bar/v1';
    const pluginId = 'my-app-plugin';
    const usePluginExtensions = createUsePluginLinks(registry);
    let { result, rerender } = renderHook(() => usePluginExtensions({ extensionPointId }));

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

  it('should only render the hook once', () => {
    const addedLinksRegistrySpy = jest.spyOn(registry, 'asObservable');
    const extensionPointId = 'plugins/foo/bar';
    const usePluginLinks = createUsePluginLinks(registry);

    renderHook(() => usePluginLinks({ extensionPointId }));
    expect(addedLinksRegistrySpy).toHaveBeenCalledTimes(1);
  });
});
