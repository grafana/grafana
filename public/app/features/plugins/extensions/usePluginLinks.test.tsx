import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';

import { ExtensionRegistriesProvider } from './ExtensionRegistriesContext';
import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from './registry/ExposedComponentsRegistry';
import { usePluginLinks } from './usePluginLinks';

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
  let addedLinks: AddedLinksRegistry;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;

  beforeEach(() => {
    addedLinks = new AddedLinksRegistry();
    const exposedComponents = new ExposedComponentsRegistry();
    const addedComponents = new AddedComponentsRegistry();

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider
        registries={{
          addedLinks,
          addedComponents,
          exposedComponents,
        }}
      >
        {children}
      </ExtensionRegistriesProvider>
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
    const extensionPointId = 'plugins/foo/bar/v1';
    const pluginId = 'my-app-plugin';

    addedLinks.register({
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
    const extensionPointId = 'plugins/foo/bar/v1';
    const pluginId = 'my-app-plugin';
    let { result, rerender } = renderHook(() => usePluginLinks({ extensionPointId }), { wrapper });

    // No extensions yet
    expect(result.current.links.length).toBe(0);

    // Add extensions to the registry
    act(() => {
      addedLinks.register({
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
    const addedLinksRegistrySpy = jest.spyOn(addedLinks, 'asObservable');
    const extensionPointId = 'plugins/foo/bar';

    renderHook(() => usePluginLinks({ extensionPointId }), { wrapper });
    expect(addedLinksRegistrySpy).toHaveBeenCalledTimes(1);
  });
});
