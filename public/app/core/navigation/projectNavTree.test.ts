import { type NavModelItem } from '@grafana/data';

import { buildNavIndex } from './navIndex';
import { getEffectivePinnedIds, projectNavTree, togglePin, isPinned } from './projectNavTree';

const canonicalTree: NavModelItem[] = [
  { id: 'home', text: 'Home', url: '/' },
  {
    id: 'dashboards/browse',
    text: 'Dashboards',
    url: '/dashboards',
    children: [{ id: 'playlists', text: 'Playlists', url: '/playlists' }],
  },
  { id: 'explore', text: 'Explore', url: '/explore' },
  {
    id: 'cfg',
    text: 'Administration',
    url: '/admin',
    children: [
      {
        id: 'cfg/plugins',
        text: 'Plugins and data',
        url: '/admin/plugins',
        children: [{ id: 'plugins', text: 'Plugins', url: '/plugins' }],
      },
    ],
  },
];

describe('projectNavTree', () => {
  it('uses default pinned ids when layout has no pins', () => {
    const { primary, overflow } = projectNavTree(canonicalTree, { layout: { version: 1 } });

    expect(primary.map((n) => n.id)).toEqual(
      expect.arrayContaining(['home', 'dashboards/browse', 'explore'])
    );
    expect(overflow.some((n) => n.id === 'cfg')).toBe(true);
  });

  it('promotes deep pinned item with breadcrumb', () => {
    const { primary, overflow } = projectNavTree(canonicalTree, {
      layout: { version: 1, pinnedIds: ['home', 'plugins'] },
    });

    const promoted = primary.find((n) => n.id === 'plugins');
    expect(promoted).toBeDefined();
    expect(promoted?.subTitle).toBe('Administration › Plugins and data');
    expect(overflow.some((n) => n.id === 'cfg')).toBe(false);
  });

  it('togglePin adds and removes ids', () => {
    const index = buildNavIndex(canonicalTree);
    const layout = togglePin({ version: 1, pinnedIds: [] }, 'explore', index);
    expect(getEffectivePinnedIds(layout, index).has('explore')).toBe(true);

    const unpinned = togglePin(layout, 'explore', index);
    expect(getEffectivePinnedIds(unpinned, index).has('explore')).toBe(false);
  });

  it('migrates bookmark urls to pinned ids', () => {
    const { primary } = projectNavTree(canonicalTree, {
      bookmarkUrls: ['/plugins'],
    });

    expect(primary.some((n) => n.id === 'plugins')).toBe(true);
  });

  it('home is always pinned', () => {
    const index = buildNavIndex(canonicalTree);
    expect(isPinned('home', getEffectivePinnedIds({ version: 1, pinnedIds: [] }, index))).toBe(true);
  });
});
