import { type NavModelItem } from '@grafana/data';

import { findNavItemForPath } from './navItemForPath';

const tree: NavModelItem[] = [
  {
    id: 'home',
    text: 'Home',
    url: '/',
  },
  {
    id: 'dashboards',
    text: 'Dashboards',
    url: '/dashboards',
    children: [
      { id: 'playlists', text: 'Playlists', url: '/playlists' },
      { id: 'snapshots', text: 'Snapshots', url: '/dashboards/snapshots' },
    ],
  },
  {
    id: 'explore',
    text: 'Explore',
    url: '/explore',
  },
  {
    id: 'untitled',
    url: '/no-text',
    text: '',
  },
];

describe('findNavItemForPath', () => {
  it('returns the item that exactly matches the pathname', () => {
    expect(findNavItemForPath(tree, '/explore')?.id).toBe('explore');
  });

  it('finds nested children', () => {
    expect(findNavItemForPath(tree, '/dashboards/snapshots')?.id).toBe('snapshots');
  });

  it('prefers the longest ancestor match for a nested unknown route', () => {
    expect(findNavItemForPath(tree, '/dashboards/snapshots/abc123')?.id).toBe('snapshots');
    expect(findNavItemForPath(tree, '/dashboards/unknown')?.id).toBe('dashboards');
  });

  it('matches the home route only on an exact "/" pathname', () => {
    expect(findNavItemForPath(tree, '/')?.id).toBe('home');
    expect(findNavItemForPath(tree, '/explore')?.id).toBe('explore');
  });

  it('skips items without both a url and text', () => {
    expect(findNavItemForPath(tree, '/no-text')).toBeUndefined();
  });

  it('returns undefined when no nav item matches', () => {
    expect(findNavItemForPath(tree, '/completely-unknown')).toBeUndefined();
  });

  it('strips the appSubUrl prefix from nav item URLs before matching', () => {
    const subUrlTree: NavModelItem[] = [
      { id: 'explore', text: 'Explore', url: '/grafana/explore' },
      {
        id: 'dashboards',
        text: 'Dashboards',
        url: '/grafana/dashboards',
        children: [{ id: 'snapshots', text: 'Snapshots', url: '/grafana/dashboards/snapshots' }],
      },
    ];
    expect(findNavItemForPath(subUrlTree, '/dashboards/snapshots', '/grafana')?.id).toBe('snapshots');
    expect(findNavItemForPath(subUrlTree, '/dashboards/unknown', '/grafana')?.id).toBe('dashboards');
  });
});
