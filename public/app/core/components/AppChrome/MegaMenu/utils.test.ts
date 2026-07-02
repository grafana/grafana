import { cloneDeep } from 'lodash';

import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';

import {
  getEnrichedHelpItem,
  getActiveItem,
  findByUrl,
  partitionNavForPinning,
  reorderPinnedBlocks,
  getPinnableLeafUrls,
  expandPinnedUrls,
  normalizePinnedUrls,
  isHideable,
  removeHiddenItems,
  hideItem,
  revealItem,
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

  describe('partitionNavForPinning', () => {
    it('moves a pinned leaf into the pinned tree and out of the rest', () => {
      const { pinned, rest } = partitionNavForPinning(tree, new Set(['/explore']));
      expect(pinned.map((i) => i.text)).toEqual(['Explore']);
      expect(rest.find((i) => i.id === 'explore')).toBeUndefined();
    });

    it('leaves everything in the rest when nothing is pinned', () => {
      const { pinned, rest } = partitionNavForPinning(tree, new Set());
      expect(pinned).toHaveLength(0);
      expect(rest.map((i) => i.id)).toEqual(['home', 'explore', 'dashboards', 'cfg']);
    });

    it('pins a child via its ancestor chain, keeping the partially-pinned parent in the rest', () => {
      const { pinned, rest } = partitionNavForPinning(tree, new Set(['/playlists']));
      expect(pinned).toHaveLength(1);
      expect(pinned[0].text).toBe('Dashboards');
      expect(pinned[0].children?.map((c) => c.text)).toEqual(['Playlists']);

      const dashboards = rest.find((i) => i.id === 'dashboards');
      expect(dashboards).toBeDefined();
      expect(dashboards?.children?.map((c) => c.text)).toEqual(['New', 'Snapshots']);
    });

    it('moves a section pinned in its own right with all its live children', () => {
      const { pinned, rest } = partitionNavForPinning(tree, new Set(['/dashboards']));
      expect(pinned).toHaveLength(1);
      expect(pinned[0].text).toBe('Dashboards');
      const childText = pinned[0].children?.map((c) => c.text);
      expect(childText).toContain('Playlists');
      expect(childText).toContain('Snapshots');
      expect(rest.find((i) => i.id === 'dashboards')).toBeUndefined();
    });

    it('only moves a section once every child is pinned', () => {
      const partial = partitionNavForPinning(tree, new Set(['/playlists']));
      expect(partial.rest.find((i) => i.id === 'dashboards')).toBeDefined();

      const full = partitionNavForPinning(tree, new Set(['/playlists', '/snapshots']));
      expect(full.rest.find((i) => i.id === 'dashboards')).toBeUndefined();
    });

    it('moves a single-child section once that child is pinned', () => {
      const { pinned, rest } = partitionNavForPinning(tree, new Set(['/admin/settings']));
      expect(pinned.find((i) => i.id === 'cfg')).toBeDefined();
      expect(rest.find((i) => i.id === 'cfg')).toBeUndefined();
    });

    it('orders the pinned blocks by the supplied order, not the nav-tree order', () => {
      const set = new Set(['/explore', '/admin/settings']);
      // Without an order, blocks follow the nav tree (Explore before Administration)
      expect(partitionNavForPinning(tree, set).pinned.map((i) => i.text)).toEqual(['Explore', 'Administration']);
      // With a user order, the blocks follow it
      expect(partitionNavForPinning(tree, set, ['/admin/settings', '/explore']).pinned.map((i) => i.text)).toEqual([
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
});

describe('More apps hoisting', () => {
  const tree: NavModelItem[] = [
    { text: 'Explore', id: 'explore', url: '/explore' },
    {
      text: 'More apps',
      id: 'apps',
      children: [
        {
          text: 'My App',
          id: 'plugin-page-my-app',
          url: '/a/my-app',
          children: [
            { text: 'Page one', id: 'plugin-page-my-app-1', url: '/a/my-app/one' },
            { text: 'Page two', id: 'plugin-page-my-app-2', url: '/a/my-app/two' },
          ],
        },
      ],
    },
  ];

  it('surfaces a pinned app at the top level, not under a "More apps" parent', () => {
    const { pinned, rest } = partitionNavForPinning(tree, new Set(['/a/my-app/one']));
    // The pinned block is the app itself (carrying the pinned page) — no "More apps" wrapper
    expect(pinned.map((i) => i.text)).toEqual(['My App']);
    expect(pinned[0].children?.map((c) => c.text)).toEqual(['Page one']);
    expect(pinned.find((i) => i.id === 'apps')).toBeUndefined();
    // "More apps" stays in the normal nav for the un-pinned pages
    expect(rest.find((i) => i.id === 'apps')).toBeDefined();
  });

  it('stores the pinned app page by its own url, never a "More apps" url', () => {
    expect(normalizePinnedUrls(new Set(['/a/my-app/one']), tree)).toEqual(['/a/my-app/one']);
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

  describe('expandPinnedUrls', () => {
    it('expands a stored section url into its leaves', () => {
      expect(expandPinnedUrls(['/dashboards'], tree)).toEqual(new Set(['/playlists', '/snapshots']));
    });

    it('keeps a stored leaf url as-is', () => {
      expect(expandPinnedUrls(['/playlists'], tree)).toEqual(new Set(['/playlists']));
    });
  });

  describe('normalizePinnedUrls', () => {
    it('collapses a fully-pinned top-level section to the section url', () => {
      expect(normalizePinnedUrls(new Set(['/playlists', '/snapshots']), tree)).toEqual(['/dashboards']);
    });

    it('keeps a partially-pinned section as individual leaves', () => {
      expect(normalizePinnedUrls(new Set(['/playlists']), tree)).toEqual(['/playlists']);
    });

    it('keeps top-level leaves and the Starred section as their own url', () => {
      expect(normalizePinnedUrls(new Set(['/explore', '/dashboards?starred']), tree)).toEqual([
        '/explore',
        '/dashboards?starred',
      ]);
    });

    it('collapses some sections while keeping others individual', () => {
      expect(normalizePinnedUrls(new Set(['/explore', '/playlists', '/snapshots']), tree)).toEqual([
        '/explore',
        '/dashboards',
      ]);
    });

    it('keeps the block order given by orderUrls', () => {
      const leaves = new Set(['/explore', '/playlists', '/snapshots']);
      expect(normalizePinnedUrls(leaves, tree, ['/dashboards', '/explore'])).toEqual(['/dashboards', '/explore']);
    });

    it('appends newly-pinned blocks after the ones already in the order', () => {
      const leaves = new Set(['/explore', '/playlists', '/snapshots']);
      expect(normalizePinnedUrls(leaves, tree, ['/explore'])).toEqual(['/explore', '/dashboards']);
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
    it('is true for a normal item but false for Home, create actions and starred sub-items', () => {
      expect(isHideable(tree[1])).toBe(true);
      expect(isHideable(tree[0])).toBe(false); // Home
      expect(isHideable({ text: 'New', id: 'dashboards/new', url: '/x', isCreateAction: true })).toBe(false);
      expect(isHideable({ text: 'Starred dash', id: 'starred/abc', url: '/d/abc' })).toBe(false);
    });
  });

  describe('removeHiddenItems', () => {
    it('drops a hidden section with its whole subtree', () => {
      const result = removeHiddenItems(tree, new Set(['dashboards']));
      expect(result.find((i) => i.id === 'dashboards')).toBeUndefined();
    });

    it('keeps a partially-hidden parent with its remaining children', () => {
      const result = removeHiddenItems(tree, new Set(['dashboards/playlists']));
      const dashboards = result.find((i) => i.id === 'dashboards');
      expect(dashboards?.children?.map((c) => c.text)).toEqual(['New', 'Snapshots']);
    });
  });

  describe('hideItem', () => {
    it('adds the id', () => {
      expect(hideItem([], tree, 'dashboards/playlists')).toEqual(['dashboards/playlists']);
    });

    it('replaces redundant descendant ids when hiding their parent', () => {
      expect(hideItem(['dashboards/playlists', 'dashboards/snapshots'], tree, 'dashboards')).toEqual(['dashboards']);
    });

    it('never collapses individually-hidden children into the parent', () => {
      expect(hideItem(['dashboards/playlists'], tree, 'dashboards/snapshots')).toEqual([
        'dashboards/playlists',
        'dashboards/snapshots',
      ]);
    });
  });

  describe('revealItem', () => {
    it('just removes the id of an explicitly-hidden item', () => {
      expect(revealItem(['dashboards/playlists'], tree, 'dashboards/playlists')).toEqual([]);
    });

    it('breaks apart a hidden parent, hiding the siblings of the revealed child', () => {
      // Dashboards hidden -> reveal Playlists -> Snapshots stays hidden individually (New is a
      // create action and isn't hideable, so it isn't added).
      expect(revealItem(['dashboards'], tree, 'dashboards/playlists')).toEqual(['dashboards/snapshots']);
    });

    it('reveals only the target path through a deep hidden subtree', () => {
      const result = revealItem(['cfg'], tree, 'cfg/access/users');
      expect(result).toEqual(expect.arrayContaining(['cfg/settings', 'cfg/access/teams']));
      expect(result).not.toContain('cfg');
      expect(result).not.toContain('cfg/access');
      expect(result).not.toContain('cfg/access/users');
    });
  });
});
