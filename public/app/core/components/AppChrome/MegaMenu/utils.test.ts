import { cloneDeep } from 'lodash';

import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';

import {
  getEnrichedHelpItem,
  getActiveItem,
  findByUrl,
  buildPinnedTree,
  reorderPinnedBlocks,
  reorderSections,
  getPinnableLeafUrls,
  orderTopLevelSections,
  isHideable,
  removeHiddenItems,
} from './utils';

const starredDashboardUid = 'foo';
const mockNavTree: NavModelItem[] = [
  {
    text: 'Bookmarks',
    url: '/bookmarks',
    id: 'bookmarks',
    children: [
      {
        text: 'Item with children',
        url: '/itemWithChildren',
        id: 'item-with-children',
        parentItem: {
          text: 'Bookmarks',
          id: 'bookmarks',
        },
      },
    ],
  },
  {
    text: 'Item',
    url: '/item',
    id: 'item',
  },
  {
    text: 'Item with children',
    url: '/itemWithChildren',
    id: 'item-with-children',
    children: [
      {
        text: 'Child',
        url: '/child',
        id: 'child',
      },
    ],
  },
  {
    text: 'Base',
    url: '/',
    id: 'home',
  },
  {
    text: 'Starred',
    url: '/dashboards?starred',
    id: 'starred',
    children: [
      {
        id: `starred/${starredDashboardUid}`,
        text: 'Lazy Loading',
        url: `/d/${starredDashboardUid}/some-name`,
      },
    ],
  },
  {
    text: 'Dashboards',
    url: '/dashboards',
    id: 'dashboards',
  },
];

jest.mock('../../../app_events', () => ({
  publish: jest.fn(),
}));

describe('enrichConfigItems', () => {
  let mockHelpNode: NavModelItem = {
    id: 'help',
    text: 'Help',
  };
  let originalBuildInfo = { ...config.buildInfo };

  beforeAll(() => {
    config.buildInfo.versionString = '9.0.0-test';
  });

  afterAll(() => {
    config.buildInfo = originalBuildInfo;
  });

  it('enhances the help node with extra child links', () => {
    const contextSrv = new ContextSrv();
    setContextSrv(contextSrv);
    const helpNode = getEnrichedHelpItem(mockHelpNode);
    expect(helpNode.children).toContainEqual(
      expect.objectContaining({
        text: 'Documentation',
      })
    );
    expect(helpNode.children).toContainEqual(
      expect.objectContaining({
        text: 'Support',
      })
    );
    expect(helpNode.children).toContainEqual(
      expect.objectContaining({
        text: 'Community',
      })
    );
    expect(helpNode.children).toContainEqual(
      expect.objectContaining({
        text: 'Keyboard shortcuts',
      })
    );
  });

  it('adds the version string as subtitle', () => {
    const helpNode = getEnrichedHelpItem(mockHelpNode);
    expect(helpNode.subTitle).toBe(config.buildInfo.versionString);
  });

  it("doesn't mutate the original help node", () => {
    const originalHelpNode = cloneDeep(mockHelpNode);
    const newHelpNode = getEnrichedHelpItem(mockHelpNode);

    // The mockHelpNode should remain deeply equal to the clone we made of it
    expect(mockHelpNode).toEqual(originalHelpNode);

    // The new node should have a different identity than the original
    expect(newHelpNode).not.toBe(mockHelpNode);
    expect(newHelpNode.children).not.toBe(mockHelpNode.children);
  });
});

describe('getActiveItem', () => {
  it('returns an exact match at the top level', () => {
    const mockPage: NavModelItem = {
      text: 'Some current page',
      id: 'item',
    };
    expect(getActiveItem(mockNavTree, mockPage)?.id).toEqual('item');
  });

  it('returns parent item if no other matches in nav tree', () => {
    const mockPage: NavModelItem = {
      text: 'Some child page',
      id: 'something-that-doesnt-exist',
      parentItem: {
        text: 'Some home page',
        id: 'home',
      },
    };
    expect(getActiveItem(mockNavTree, mockPage)?.id).toEqual('home');
  });

  it('returns an exact child match', () => {
    const mockPage: NavModelItem = {
      text: 'Some child page',
      id: 'child',
      parentItem: {
        text: 'Item with children',
        id: 'item-with-children',
      },
    };
    expect(getActiveItem(mockNavTree, mockPage)?.id).toEqual('child');
  });

  it('handles home page', () => {
    const mockPage: NavModelItem = {
      text: 'Something else',
      id: 'not-home',
    };
    expect(getActiveItem(mockNavTree, mockPage, '/')?.id).toEqual('home');
  });
});

describe('findByUrl', () => {
  it('returns the correct item at the top level', () => {
    expect(findByUrl(mockNavTree, '/item')).toEqual({
      text: 'Item',
      url: '/item',
      id: 'item',
    });
  });

  it('returns the correct child item', () => {
    expect(findByUrl(mockNavTree, '/child')).toEqual({
      text: 'Child',
      url: '/child',
      id: 'child',
    });
  });

  it('returns null if no item found', () => {
    expect(findByUrl(mockNavTree, '/no-item')).toBeNull();
  });
});

describe('pinning helpers', () => {
  const tree: NavModelItem[] = [
    { text: 'Home', id: 'home', url: '/' },
    { text: 'Explore', id: 'explore', url: '/explore' },
    {
      text: 'Dashboards',
      id: 'dashboards',
      url: '/dashboards',
      children: [
        { text: 'New', id: 'dashboards/new', url: '/dashboard/new', isCreateAction: true },
        { text: 'Playlists', id: 'dashboards/playlists', url: '/playlists' },
        { text: 'Snapshots', id: 'dashboards/snapshots', url: '/snapshots' },
      ],
    },
    {
      text: 'Administration',
      id: 'cfg',
      url: '/admin',
      children: [{ text: 'Settings', id: 'cfg/settings', url: '/admin/settings' }],
    },
  ];

  describe('buildPinnedTree (the pinned box mini-tree)', () => {
    it('shows a pinned leaf as a top-level endpoint', () => {
      expect(buildPinnedTree(tree, new Set(['/explore'])).map((i) => i.text)).toEqual(['Explore']);
    });

    it('is empty when nothing is pinned', () => {
      expect(buildPinnedTree(tree, new Set())).toHaveLength(0);
    });

    it('surfaces a pinned child under its ancestor chain', () => {
      const pinned = buildPinnedTree(tree, new Set(['/playlists']));
      expect(pinned).toHaveLength(1);
      expect(pinned[0].text).toBe('Dashboards');
      expect(pinned[0].children?.map((c) => c.text)).toEqual(['Playlists']);
    });

    it('renders a directly-pinned section as an endpoint (children not expanded)', () => {
      const pinned = buildPinnedTree(tree, new Set(['/dashboards']));
      expect(pinned.map((i) => i.text)).toEqual(['Dashboards']);
      expect(pinned[0].children).toBeUndefined();
    });

    it('keeps a pinned top-level Starred section together with its starred dashboards', () => {
      const withStarred: NavModelItem[] = [
        ...tree,
        {
          text: 'Starred',
          id: 'starred',
          url: '/dashboards?starred',
          children: [{ text: 'My dashboard', id: 'starred/abc', url: '/d/abc' }],
        },
      ];
      const pinned = buildPinnedTree(withStarred, new Set(['/dashboards?starred']));
      expect(pinned.map((i) => i.text)).toEqual(['Starred']);
      // Starred is a special case: it pins as a whole but still lists its child dashboards in the box.
      expect(pinned[0].children?.map((c) => c.text)).toEqual(['My dashboard']);
    });

    it('orders the top-level blocks by the supplied pin order', () => {
      const set = new Set(['/explore', '/admin/settings']);
      // Without an order, blocks follow the nav tree (Explore before Administration)
      expect(buildPinnedTree(tree, set).map((i) => i.text)).toEqual(['Explore', 'Administration']);
      // With a user order, the blocks follow it
      expect(buildPinnedTree(tree, set, ['/admin/settings', '/explore']).map((i) => i.text)).toEqual([
        'Administration',
        'Explore',
      ]);
    });
  });

  describe('reorderPinnedBlocks', () => {
    it("moves a top-level block, keeping each block's urls grouped", () => {
      expect(reorderPinnedBlocks(['/explore', '/dashboards'], tree, 1, 0)).toEqual(['/dashboards', '/explore']);
    });

    it('moves a partially-pinned block by its leaves', () => {
      // Blocks are [Dashboards(→Playlists), Explore]; move Explore (index 1) to the front
      expect(reorderPinnedBlocks(['/playlists', '/explore'], tree, 1, 0)).toEqual(['/explore', '/playlists']);
    });

    it('is a no-op for out-of-range indices', () => {
      expect(reorderPinnedBlocks(['/explore', '/dashboards'], tree, 0, 5)).toEqual(['/explore', '/dashboards']);
    });
  });

  describe('orderTopLevelSections', () => {
    it('orders sections by the stored id list', () => {
      expect(orderTopLevelSections(tree, ['cfg', 'explore']).map((i) => i.id)).toEqual([
        'cfg',
        'explore',
        'home',
        'dashboards',
      ]);
    });

    it('appends sections not in the stored order, keeping their nav-tree order', () => {
      expect(orderTopLevelSections(tree, ['dashboards']).map((i) => i.id)).toEqual([
        'dashboards',
        'home',
        'explore',
        'cfg',
      ]);
    });
  });

  describe('reorderSections', () => {
    it('moves a section to a new index, returning the full id order', () => {
      // From the default nav order [home, explore, dashboards, cfg], move dashboards (2) to the front.
      expect(reorderSections(tree, [], 2, 0)).toEqual(['dashboards', 'home', 'explore', 'cfg']);
    });

    it('reorders relative to an existing stored order', () => {
      // Stored order puts cfg first: [cfg, home, explore, dashboards]; move cfg (0) to the end.
      expect(reorderSections(tree, ['cfg'], 0, 3)).toEqual(['home', 'explore', 'dashboards', 'cfg']);
    });

    it('is a no-op for out-of-range indices, keeping the current order', () => {
      expect(reorderSections(tree, ['cfg', 'explore'], 0, 9)).toEqual(['cfg', 'explore']);
    });
  });
});

describe('canonical pin set helpers', () => {
  const tree: NavModelItem[] = [
    { text: 'Explore', id: 'explore', url: '/explore' },
    {
      text: 'Dashboards',
      id: 'dashboards',
      url: '/dashboards',
      children: [
        { text: 'New', id: 'dashboards/new', url: '/dashboard/new', isCreateAction: true },
        { text: 'Playlists', id: 'dashboards/playlists', url: '/playlists' },
        { text: 'Snapshots', id: 'dashboards/snapshots', url: '/snapshots' },
      ],
    },
    {
      text: 'Starred',
      id: 'starred',
      url: '/dashboards?starred',
      children: [{ text: 'My dashboard', id: 'starred/abc', url: '/d/abc' }],
    },
    { text: 'Home', id: 'home', url: '/' },
  ];

  describe('getPinnableLeafUrls', () => {
    it('returns the url of a leaf', () => {
      expect(getPinnableLeafUrls(tree[0])).toEqual(['/explore']);
    });

    it('returns the leaves of a section, ignoring create actions', () => {
      expect(getPinnableLeafUrls(tree[1])).toEqual(['/playlists', '/snapshots']);
    });

    it('treats a section whose children are not pinnable (Starred) as a leaf', () => {
      expect(getPinnableLeafUrls(tree[2])).toEqual(['/dashboards?starred']);
    });
  });
});

describe('hiding helpers', () => {
  const tree: NavModelItem[] = [
    { text: 'Home', id: 'home', url: '/' },
    { text: 'Explore', id: 'explore', url: '/explore' },
    {
      text: 'Dashboards',
      id: 'dashboards',
      url: '/dashboards',
      children: [
        { text: 'New', id: 'dashboards/new', url: '/dashboard/new', isCreateAction: true },
        { text: 'Playlists', id: 'dashboards/playlists', url: '/playlists' },
        { text: 'Snapshots', id: 'dashboards/snapshots', url: '/snapshots' },
      ],
    },
    {
      text: 'Administration',
      id: 'cfg',
      url: '/admin',
      children: [
        {
          text: 'Users & access',
          id: 'cfg/access',
          url: '/admin/access',
          children: [
            { text: 'Users', id: 'cfg/access/users', url: '/admin/users' },
            { text: 'Teams', id: 'cfg/access/teams', url: '/admin/teams' },
          ],
        },
        { text: 'Settings', id: 'cfg/settings', url: '/admin/settings' },
      ],
    },
  ];

  describe('isHideable', () => {
    it('is true for a top-level section but false for Home, Bookmarks and Starred', () => {
      expect(isHideable(tree[1])).toBe(true); // Explore
      expect(isHideable(tree[0])).toBe(false); // Home
      expect(isHideable({ text: 'Bookmarks', id: 'bookmarks', url: '/bookmarks' })).toBe(false);
      // Starred is pinnable instead of hideable.
      expect(isHideable({ text: 'Starred', id: 'starred', url: '/dashboards?starred' })).toBe(false);
    });
  });

  describe('removeHiddenItems', () => {
    it('drops hidden top-level sections', () => {
      expect(removeHiddenItems(tree, new Set(['dashboards'])).map((i) => i.id)).toEqual(['home', 'explore', 'cfg']);
    });

    it('leaves child ids alone (hiding is top-level only)', () => {
      const result = removeHiddenItems(tree, new Set(['dashboards/playlists']));
      expect(result.map((i) => i.id)).toEqual(['home', 'explore', 'dashboards', 'cfg']);
      expect(result.find((i) => i.id === 'dashboards')?.children?.map((c) => c.text)).toEqual([
        'New',
        'Playlists',
        'Snapshots',
      ]);
    });
  });
});
