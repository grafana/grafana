import { type NavModelItem } from '@grafana/data';

import { type CmdkItem, type CmdkItemNavigation, type CmdkItemSubscope } from '../types';

import {
  ACTIONS_PRIORITY,
  createStaticActionsSource,
  DEFAULT_PRIORITY,
  filterStaticEntries,
  navTreeToEntries,
  SECTION_ACTIONS,
  SECTION_PAGES,
} from './staticActionsSource';

function navItem(partial: Partial<NavModelItem> & { text: string }): NavModelItem {
  return { ...partial };
}

function expectNavigation(item: CmdkItem | undefined): CmdkItemNavigation {
  if (item?.type !== 'navigation') {
    throw new Error(`Expected navigation item, got ${item?.type}`);
  }
  return item;
}

function expectSubscope(item: CmdkItem | undefined): CmdkItemSubscope {
  if (item?.type !== 'subscope') {
    throw new Error(`Expected subscope item, got ${item?.type}`);
  }
  return item;
}

describe('navTreeToEntries', () => {
  it('converts nav items with url to navigation items in the pages section', () => {
    const entries = navTreeToEntries([navItem({ id: 'dashboards', text: 'Dashboards', url: '/dashboards' })]);

    expect(entries).toHaveLength(1);
    const item = expectNavigation(entries[0].item);
    expect(item.href).toBe('/dashboards');
    expect(item.sectionId).toBe(SECTION_PAGES);
    expect(item.priority).toBe(DEFAULT_PRIORITY);
    expect(entries[0].topLevel).toBe(true);
  });

  it('converts create actions to the actions section without subtitle', () => {
    const entries = navTreeToEntries([
      navItem({
        id: 'parent',
        text: 'Parent',
        url: '/parent',
        children: [navItem({ id: 'new-dash', text: 'New dashboard', url: '/dashboard/new', isCreateAction: true })],
      }),
    ]);

    const createEntry = entries.find((entry) => entry.item.id === 'navModel.new-dash');
    expect(createEntry?.item.sectionId).toBe(SECTION_ACTIONS);
    expect(createEntry?.item.priority).toBe(ACTIONS_PRIORITY);
    expect(createEntry?.item.subtitle).toBeUndefined();
    // Create actions show for the empty query even though they are nested in the nav tree
    expect(createEntry?.topLevel).toBe(true);
    expect(filterStaticEntries(entries, '').map((item) => item.id)).toContain('navModel.new-dash');
  });

  it('converts nav items with only onClick to action items', () => {
    const onClick = jest.fn();
    const entries = navTreeToEntries([navItem({ id: 'action', text: 'Do something', onClick })]);

    expect(entries[0].item.type).toBe('action');
  });

  it('skips nav items without url, onClick or children', () => {
    const entries = navTreeToEntries([navItem({ id: 'empty', text: 'Nothing here' })]);

    expect(entries).toHaveLength(0);
  });

  it('flattens children as searchable non top level entries with the parent path as subtitle', () => {
    const entries = navTreeToEntries([
      navItem({
        id: 'parent',
        text: 'Parent',
        url: '/parent',
        children: [navItem({ id: 'child', text: 'Child page', url: '/parent/child' })],
      }),
    ]);

    expect(entries).toHaveLength(2);
    const child = entries[1];
    expect(child.topLevel).toBe(false);
    expect(child.item.subtitle).toBe('Parent');
    expect(child.searchText).toContain('Parent');
  });

  it('turns nav items with only children into a subscope over those children', async () => {
    const entries = navTreeToEntries([
      navItem({
        id: 'group',
        text: 'Group',
        children: [navItem({ id: 'child', text: 'Child page', url: '/child' })],
      }),
    ]);

    const subscope = expectSubscope(entries[0].item);
    const scope = subscope.getScope();
    expect(scope.subscopeName).toBe('Group');

    const scopedItems = await scope.query('', new AbortController().signal);
    expect(scopedItems).toHaveLength(1);
    expect(expectNavigation(scopedItems[0]).href).toBe('/child');
  });

  it('gives navigation items with children a browse-children subscope action', async () => {
    const entries = navTreeToEntries([
      navItem({
        id: 'drilldown',
        text: 'Drilldown',
        url: '/drilldown',
        children: [navItem({ id: 'metrics', text: 'Metrics', url: '/drilldown/metrics' })],
      }),
    ]);

    const item = expectNavigation(entries[0].item);
    expect(item.additionalActions).toHaveLength(1);
    const browseAction = item.additionalActions?.[0];
    if (browseAction?.type !== 'subscope') {
      throw new Error(`Expected subscope action, got ${browseAction?.type}`);
    }
    expect(browseAction.shortcut).toBe('shift+enter');

    const scope = browseAction.getScope();
    expect(scope.subscopeName).toBe('Drilldown');
    const scopedItems = await scope.query('', new AbortController().signal);
    expect(scopedItems.map((scopedItem) => scopedItem.title)).toEqual(['Metrics']);
  });

  it('does not add a browse action to items without children', () => {
    const entries = navTreeToEntries([navItem({ id: 'explore', text: 'Explore', url: '/explore' })]);

    expect(expectNavigation(entries[0].item).additionalActions).toBeUndefined();
  });

  it('passes the link target through', () => {
    const entries = navTreeToEntries([
      navItem({ id: 'docs', text: 'Documentation', url: 'https://grafana.com/docs', target: '_blank' }),
    ]);

    expect(expectNavigation(entries[0].item).target).toBe('_blank');
  });
});

describe('filterStaticEntries', () => {
  const tree = [
    navItem({
      id: 'dashboards',
      text: 'Dashboards',
      url: '/dashboards',
      children: [navItem({ id: 'playlists', text: 'Playlists', url: '/playlists', keywords: ['slideshow'] })],
    }),
    navItem({ id: 'explore', text: 'Explore', url: '/explore' }),
  ];

  it('returns only top level entries for the empty query', () => {
    const items = filterStaticEntries(navTreeToEntries(tree), '');

    expect(items.map((item) => item.title)).toEqual(['Dashboards', 'Explore']);
  });

  it('matches nested entries when searching', () => {
    const items = filterStaticEntries(navTreeToEntries(tree), 'playlist');

    expect(items.map((item) => item.title)).toEqual(['Playlists']);
  });

  it('matches entries by keywords', () => {
    const items = filterStaticEntries(navTreeToEntries(tree), 'slideshow');

    expect(items.map((item) => item.title)).toEqual(['Playlists']);
  });

  it('computes the add-new-connection href from the query', () => {
    const entries = navTreeToEntries([
      navItem({
        id: 'connections-add-new-connection',
        text: 'Add new connection',
        url: '/connections/add-new-connection',
        keywords: ['prometheus', 'loki'],
      }),
    ]);

    const [item] = filterStaticEntries(entries, 'loki');
    expect(expectNavigation(item).href).toBe('/connections/add-new-connection?search=loki');
  });
});

describe('createStaticActionsSource', () => {
  it('provides the static sections up front', () => {
    const source = createStaticActionsSource([]);

    expect(source.providedSections.map((section) => section.id)).toEqual(['actions', 'pages', 'preferences']);
  });
});
