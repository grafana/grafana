import { renderHook } from '@testing-library/react';

import { type PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';

import { EXTENSIONS_PRIORITY } from '../values';

import useExtensionActions from './useExtensionActions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

const usePluginLinksMock = jest.mocked(usePluginLinks);

function makeLink(
  overrides: Partial<PluginExtensionLink> & Pick<PluginExtensionLink, 'id' | 'title' | 'pluginId'>
): PluginExtensionLink {
  return {
    type: PluginExtensionTypes.link,
    description: '',
    ...overrides,
  };
}

describe('useExtensionActions', () => {
  beforeEach(() => {
    usePluginLinksMock.mockReturnValue({ links: [], isLoading: false });
  });

  it('returns empty array when there are no links', () => {
    const { result } = renderHook(() => useExtensionActions());
    expect(result.current).toEqual([]);
  });

  it('returns flat root actions for ungrouped links', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        makeLink({ id: 'link-1', title: 'Do thing', pluginId: 'grafana-test-app', path: '/a/test', category: 'Test' }),
        makeLink({ id: 'link-2', title: 'Do other', pluginId: 'grafana-test-app' }),
      ],
    } as unknown as ReturnType<typeof usePluginLinks>);

    const { result } = renderHook(() => useExtensionActions());

    expect(result.current).toEqual([
      expect.objectContaining({
        id: 'link-1',
        name: 'Do thing',
        section: 'Test',
        priority: EXTENSIONS_PRIORITY,
        url: '/a/test',
      }),
      expect.objectContaining({
        id: 'link-2',
        name: 'Do other',
        section: 'Extensions',
        priority: EXTENSIONS_PRIORITY,
      }),
    ]);

    // Root actions must not have a parent property
    expect(result.current[0]).not.toHaveProperty('parent');
    expect(result.current[1]).not.toHaveProperty('parent');
  });

  it('creates a parent action and child actions for grouped links', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        makeLink({
          id: 'link-a',
          title: 'Action A',
          pluginId: 'my-plugin',
          group: { name: 'My Group' },
        }),
        makeLink({
          id: 'link-b',
          title: 'Action B',
          pluginId: 'my-plugin',
          group: { name: 'My Group' },
        }),
      ],
    } as unknown as ReturnType<typeof usePluginLinks>);

    const { result } = renderHook(() => useExtensionActions());

    // 1 parent + 2 children = 3
    expect(result.current).toHaveLength(3);

    const parent = result.current[0];
    expect(parent).toEqual(
      expect.objectContaining({
        id: 'ext-group/my-plugin/My Group',
        name: 'My Group',
        section: 'My Group',
        priority: EXTENSIONS_PRIORITY,
      })
    );

    const childA = result.current[1];
    expect(childA).toEqual(
      expect.objectContaining({
        id: 'link-a',
        name: 'Action A',
        section: 'My Group',
        parent: 'ext-group/my-plugin/My Group',
        priority: EXTENSIONS_PRIORITY,
      })
    );

    const childB = result.current[2];
    expect(childB).toEqual(
      expect.objectContaining({
        id: 'link-b',
        name: 'Action B',
        section: 'My Group',
        parent: 'ext-group/my-plugin/My Group',
        priority: EXTENSIONS_PRIORITY,
      })
    );
  });

  it('creates separate parents for different plugins with the same group name', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        makeLink({
          id: 'link-1',
          title: 'Plugin A action',
          pluginId: 'plugin-a',
          group: { name: 'Shared Name' },
        }),
        makeLink({
          id: 'link-2',
          title: 'Plugin B action',
          pluginId: 'plugin-b',
          group: { name: 'Shared Name' },
        }),
      ],
    } as unknown as ReturnType<typeof usePluginLinks>);

    const { result } = renderHook(() => useExtensionActions());

    // 2 parents + 2 children = 4
    expect(result.current).toHaveLength(4);

    const parentIds = result.current.filter((a) => a.id.startsWith('ext-group/')).map((a) => a.id);
    expect(parentIds).toEqual(['ext-group/plugin-a/Shared Name', 'ext-group/plugin-b/Shared Name']);
  });

  it('handles a mix of grouped and ungrouped links', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        makeLink({ id: 'ungrouped-1', title: 'Standalone', pluginId: 'my-plugin' }),
        makeLink({
          id: 'grouped-1',
          title: 'Grouped A',
          pluginId: 'my-plugin',
          group: { name: 'Tools' },
          category: 'Custom',
        }),
        makeLink({
          id: 'grouped-2',
          title: 'Grouped B',
          pluginId: 'my-plugin',
          group: { name: 'Tools' },
          category: 'Custom',
        }),
      ],
    } as unknown as ReturnType<typeof usePluginLinks>);

    const { result } = renderHook(() => useExtensionActions());

    // 1 ungrouped root + 1 parent + 2 children = 4
    expect(result.current).toHaveLength(4);

    // First: ungrouped root action
    expect(result.current[0]).toEqual(expect.objectContaining({ id: 'ungrouped-1', section: 'Extensions' }));

    // Second: group parent and children use group.name as section
    expect(result.current[1]).toEqual(expect.objectContaining({ id: 'ext-group/my-plugin/Tools', section: 'Tools' }));

    // Third and fourth: children
    expect(result.current[2]).toEqual(
      expect.objectContaining({ id: 'grouped-1', section: 'Tools', parent: 'ext-group/my-plugin/Tools' })
    );
    expect(result.current[3]).toEqual(
      expect.objectContaining({ id: 'grouped-2', section: 'Tools', parent: 'ext-group/my-plugin/Tools' })
    );
  });

  it('invokes onClick when perform is called on a child action', () => {
    const onClick = jest.fn();
    usePluginLinksMock.mockReturnValue({
      links: [
        makeLink({
          id: 'link-click',
          title: 'Clickable',
          pluginId: 'my-plugin',
          group: { name: 'G' },
          onClick,
        }),
      ],
    } as unknown as ReturnType<typeof usePluginLinks>);

    const { result } = renderHook(() => useExtensionActions());
    const child = result.current[1]; // index 0 is parent
    child.perform?.(undefined as never);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('treats empty group name as ungrouped', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        makeLink({
          id: 'link-empty',
          title: 'Empty Group',
          pluginId: 'my-plugin',
          group: { name: '' },
        }),
      ],
    } as unknown as ReturnType<typeof usePluginLinks>);

    const { result } = renderHook(() => useExtensionActions());

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toEqual(
      expect.objectContaining({
        id: 'link-empty',
        name: 'Empty Group',
        section: 'Extensions',
        priority: EXTENSIONS_PRIORITY,
      })
    );
    expect(result.current[0]).not.toHaveProperty('parent');
  });

  it('treats whitespace-only group name as ungrouped', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        makeLink({
          id: 'link-ws',
          title: 'Whitespace Group',
          pluginId: 'my-plugin',
          group: { name: '   ' },
        }),
      ],
    } as unknown as ReturnType<typeof usePluginLinks>);

    const { result } = renderHook(() => useExtensionActions());

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toEqual(
      expect.objectContaining({
        id: 'link-ws',
        name: 'Whitespace Group',
        section: 'Extensions',
        priority: EXTENSIONS_PRIORITY,
      })
    );
    expect(result.current[0]).not.toHaveProperty('parent');
  });

  it('trims group name for grouping key', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        makeLink({
          id: 'link-trim-a',
          title: 'Trim A',
          pluginId: 'my-plugin',
          group: { name: ' Tools ' },
        }),
        makeLink({
          id: 'link-trim-b',
          title: 'Trim B',
          pluginId: 'my-plugin',
          group: { name: 'Tools' },
        }),
      ],
    } as unknown as ReturnType<typeof usePluginLinks>);

    const { result } = renderHook(() => useExtensionActions());

    // 1 parent + 2 children = 3 (both collapse into same group)
    expect(result.current).toHaveLength(3);

    const parent = result.current[0];
    expect(parent).toEqual(
      expect.objectContaining({
        id: 'ext-group/my-plugin/Tools',
        name: 'Tools',
        section: 'Tools',
      })
    );

    expect(result.current[1]).toEqual(
      expect.objectContaining({ id: 'link-trim-a', parent: 'ext-group/my-plugin/Tools' })
    );
    expect(result.current[2]).toEqual(
      expect.objectContaining({ id: 'link-trim-b', parent: 'ext-group/my-plugin/Tools' })
    );
  });
});
