import { cloneDeep } from 'lodash';

import { type NavModelItem } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';

import {
  getEnrichedHelpItem,
  getActiveItem,
  findByUrl,
  getPinnedEntries,
  moveItem,
  reorderSections,
  orderTopLevelSections,
  isHideable,
  removeHiddenItems,
  hideItem,
  revealItem,
  enrichWithInteractionTracking,
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

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
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

describe('enrichWithInteractionTracking', () => {
  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
  });

  it('reports a starred folder click with itemKind folder', () => {
    const item: NavModelItem = {
      text: 'Folder 1',
      id: 'starred/f1',
      url: '/dashboards/f/f1/',
      parentItem: { text: 'Starred', id: 'starred' },
    };

    enrichWithInteractionTracking(item, false).onClick?.();

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_navigation_item_clicked',
      expect.objectContaining({ itemIsStarred: true, itemKind: 'folder' })
    );
  });

  it('reports a starred dashboard click with itemKind dashboard', () => {
    const item: NavModelItem = {
      text: 'Dashboard 1',
      id: 'starred/d1',
      url: '/d/d1',
      parentItem: { text: 'Starred', id: 'starred' },
    };

    enrichWithInteractionTracking(item, false).onClick?.();

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_navigation_item_clicked',
      expect.objectContaining({ itemIsStarred: true, itemKind: 'dashboard' })
    );
  });

  it('reports non-starred items as not starred and without a kind', () => {
    const item: NavModelItem = {
      text: 'Playlists',
      id: 'dashboards/playlists',
      url: '/playlists',
      parentItem: { text: 'Dashboards', id: 'dashboards' },
    };

    enrichWithInteractionTracking(item, false).onClick?.();

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_navigation_item_clicked',
      expect.objectContaining({ itemIsStarred: false, itemKind: undefined })
    );
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

  describe('getPinnedEntries (the pinned box breadcrumbs)', () => {
    const withStarred: NavModelItem[] = [
      ...tree,
      {
        text: 'Starred',
        id: 'starred',
        url: '/dashboards?starred',
        children: [
          { text: 'First', id: 'starred/a', url: '/d/a' },
          { text: 'Second', id: 'starred/b', url: '/d/b' },
        ],
      },
    ];

    it('is empty when nothing is pinned', () => {
      expect(getPinnedEntries(tree, [])).toHaveLength(0);
    });

    it('resolves a leaf to one line with no ancestors', () => {
      const entries = getPinnedEntries(tree, ['/explore']);
      expect(entries).toHaveLength(1);
      expect(entries[0].url).toBe('/explore');
      expect(entries[0].section).toBeUndefined();
      expect(entries[0].line?.item.text).toBe('Explore');
      expect(entries[0].line?.ancestors).toEqual([]);
    });

    it('resolves a nested child to a single line carrying its ancestor path', () => {
      const entries = getPinnedEntries(tree, ['/playlists']);
      expect(entries[0].line?.item.text).toBe('Playlists');
      expect(entries[0].line?.ancestors).toEqual(['Dashboards']);
    });

    it('resolves a top-level parent section to a quick-link breadcrumb, not an expandable section', () => {
      // A parent's children are individually pinnable, so pinning the parent is a plain quick-link
      // (only Starred, whose children aren't pinnable, renders as an expandable section).
      const entries = getPinnedEntries(tree, ['/dashboards']);
      expect(entries).toHaveLength(1);
      expect(entries[0].section).toBeUndefined();
      expect(entries[0].line?.item.text).toBe('Dashboards');
      expect(entries[0].line?.ancestors).toEqual([]);
    });

    it('keeps the stored order and skips urls that match no nav item', () => {
      const entries = getPinnedEntries(tree, ['/admin/settings', '/nope', '/explore']);
      expect(entries.map((e) => e.url)).toEqual(['/admin/settings', '/explore']);
    });

    it('flags a whole-section pin (Starred) with its section node and no breadcrumb line', () => {
      const entries = getPinnedEntries(withStarred, ['/dashboards?starred']);
      expect(entries).toHaveLength(1);
      expect(entries[0].url).toBe('/dashboards?starred');
      // The section node is carried (its children render the list); there's no single breadcrumb line.
      expect(entries[0].line).toBeUndefined();
      expect(entries[0].section?.text).toBe('Starred');
      expect(entries[0].section?.children?.map((c) => c.text)).toEqual(['First', 'Second']);
    });

    it('treats an empty Starred section as a section, not a breadcrumb', () => {
      // The backend serves Starred with no children until the stars have loaded. It must still be a
      // section so it keeps its layout + empty/loading state instead of flipping from breadcrumb to
      // section once children arrive.
      const emptyStarred: NavModelItem[] = [
        ...tree,
        { text: 'Starred', id: 'starred', url: '/dashboards?starred', children: [] },
      ];
      const entries = getPinnedEntries(emptyStarred, ['/dashboards?starred']);
      expect(entries).toHaveLength(1);
      expect(entries[0].section?.text).toBe('Starred');
      expect(entries[0].line).toBeUndefined();
    });
  });

  describe('moveItem', () => {
    it('moves an element to a new index', () => {
      expect(moveItem(['/explore', '/dashboards', '/admin'], 2, 0)).toEqual(['/admin', '/explore', '/dashboards']);
    });

    it('is a no-op for out-of-range indices', () => {
      expect(moveItem(['/explore', '/dashboards'], 0, 5)).toEqual(['/explore', '/dashboards']);
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
    it('is true for sections and children, but false for Home/Bookmarks/Starred, create actions and starred sub-items', () => {
      expect(isHideable(tree[1])).toBe(true); // Explore (top-level)
      expect(isHideable({ text: 'Users', id: 'cfg/access/users', url: '/admin/users' })).toBe(true); // nested child
      // A plugin nav item with only a url (no id) is still hideable — keyed by its url.
      expect(isHideable({ text: 'Workspace', url: '/a/assistant/workspace' })).toBe(true);
      expect(isHideable({ text: 'No key' })).toBe(false); // neither id nor url
      expect(isHideable(tree[0])).toBe(false); // Home
      expect(isHideable({ text: 'Bookmarks', id: 'bookmarks', url: '/bookmarks' })).toBe(false);
      expect(isHideable({ text: 'Starred', id: 'starred', url: '/dashboards?starred' })).toBe(false);
      expect(isHideable({ text: 'New', id: 'dashboards/new', url: '/dashboard/new', isCreateAction: true })).toBe(
        false
      );
      expect(isHideable({ text: 'A dashboard', id: 'starred/abc', url: '/d/abc' })).toBe(false);
    });
  });

  describe('removeHiddenItems (recursive)', () => {
    it('drops a hidden top-level section with its subtree', () => {
      expect(removeHiddenItems(tree, new Set(['dashboards'])).map((i) => i.id)).toEqual(['home', 'explore', 'cfg']);
    });

    it('drops a hidden child while keeping its non-hidden siblings and parent', () => {
      const result = removeHiddenItems(tree, new Set(['dashboards/playlists']));
      expect(result.map((i) => i.id)).toEqual(['home', 'explore', 'dashboards', 'cfg']);
      expect(result.find((i) => i.id === 'dashboards')?.children?.map((c) => c.id)).toEqual([
        'dashboards/new',
        'dashboards/snapshots',
      ]);
    });

    it('drops a deeply-nested child', () => {
      const result = removeHiddenItems(tree, new Set(['cfg/access/users']));
      const access = result.find((i) => i.id === 'cfg')?.children?.find((c) => c.id === 'cfg/access');
      expect(access?.children?.map((c) => c.id)).toEqual(['cfg/access/teams']);
    });
  });

  describe('hideItem / revealItem', () => {
    it('hides an item by id, dropping now-redundant descendant ids', () => {
      expect(hideItem(['cfg/access/users'], tree, 'cfg/access')).toEqual(['cfg/access']);
    });

    it('reveals an explicitly-hidden item by removing its id', () => {
      expect(revealItem(['cfg/access', 'explore'], tree, 'cfg/access')).toEqual(['explore']);
    });

    it('reveals an item under a hidden ancestor by breaking the ancestor apart', () => {
      // Administration (cfg) is hidden; revealing Users removes that hide and re-hides the off-path
      // siblings down the path (Settings under cfg, Teams under access) so only the Users path shows.
      const result = revealItem(['cfg'], tree, 'cfg/access/users');
      expect(new Set(result)).toEqual(new Set(['cfg/settings', 'cfg/access/teams']));
    });
  });
});
