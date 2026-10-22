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

  it('ignores trailing slashes on either side', () => {
    expect(findNavItemForPath(tree, '/explore/')?.id).toBe('explore');
    const treeWithTrailing: NavModelItem[] = [{ id: 'x', text: 'X', url: '/x/' }];
    expect(findNavItemForPath(treeWithTrailing, '/x')?.id).toBe('x');
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

  it('ignores query strings and hash fragments on the nav item URL', () => {
    const treeWithQuery: NavModelItem[] = [{ id: 'edit', text: 'Edit', url: '/dashboards/d/abc?editview=panels' }];
    expect(findNavItemForPath(treeWithQuery, '/dashboards/d/abc')?.id).toBe('edit');
    const treeWithHash: NavModelItem[] = [{ id: 'anchor', text: 'Anchor', url: '/foo#bar' }];
    expect(findNavItemForPath(treeWithHash, '/foo')?.id).toBe('anchor');
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
    expect(findNavItemForPath(subUrlTree, '/explore', '/grafana')?.id).toBe('explore');
    expect(findNavItemForPath(subUrlTree, '/dashboards/snapshots', '/grafana')?.id).toBe('snapshots');
    expect(findNavItemForPath(subUrlTree, '/dashboards/unknown', '/grafana')?.id).toBe('dashboards');
  });

  it('tolerates a trailing slash on appSubUrl', () => {
    const subUrlTree: NavModelItem[] = [{ id: 'explore', text: 'Explore', url: '/grafana/explore' }];
    expect(findNavItemForPath(subUrlTree, '/explore', '/grafana/')?.id).toBe('explore');
  });

  it('still matches when appSubUrl is empty (default behavior)', () => {
    expect(findNavItemForPath(tree, '/explore', '')?.id).toBe('explore');
    expect(findNavItemForPath(tree, '/explore')?.id).toBe('explore');
  });
});
