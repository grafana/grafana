import { type NavModelItem } from '@grafana/data';

// Shared nav-tree fixtures for the mega menu tests.

/** A small nested tree (with a profile item to assert filtering) for the non-customisation tests. */
export const nestedNavTree: NavModelItem[] = [
  {
    text: 'Section name',
    id: 'section',
    url: 'section',
    children: [
      {
        text: 'Child1',
        id: 'child1',
        url: 'section/child1',
        children: [{ text: 'Grandchild1', id: 'grandchild1', url: 'section/child1/grandchild1' }],
      },
      { text: 'Child2', id: 'child2', url: 'section/child2' },
    ],
  },
  {
    text: 'Profile',
    id: 'profile',
    url: 'profile',
  },
];

/** The full tree the customisation tests render: pinnable sections, Starred, and the Bookmarks section. */
export const customisableNavTree: NavModelItem[] = [
  { text: 'Home', id: 'home', url: '/' },
  { text: 'Explore', id: 'explore', url: '/explore' },
  { text: 'Alerting', id: 'alerting', url: '/alerting' },
  {
    text: 'Dashboards',
    id: 'dashboards',
    url: '/dashboards',
    children: [
      { text: 'New dashboard', id: 'dashboards/new', url: '/dashboard/new', isCreateAction: true },
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
  {
    text: 'Starred',
    id: 'starred',
    url: '/dashboards?starred',
    children: [{ text: 'My dashboard', id: 'starred/abc', url: '/d/abc/my-dashboard' }],
  },
  { text: 'Bookmarks', id: 'bookmarks', url: '/bookmarks' },
];
