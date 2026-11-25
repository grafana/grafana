import { toPageHistoryItem } from './toPageHistoryItem';
import { type PageHistoryEntry } from './types';

describe('toPageHistoryItem', () => {
  it('keeps the kind, uid, pathname and time of a row', () => {
    const entry: PageHistoryEntry = {
      kind: 'dashboard',
      uid: 'cpu',
      pathname: '/d/cpu/cpu',
      search: '?orgId=1',
      lastVisited: 1_700_000_000_000,
      title: 'CPU',
    };

    expect(toPageHistoryItem(entry)).toEqual({
      kind: 'dashboard',
      uid: 'cpu',
      pathname: '/d/cpu/cpu',
      lastVisited: 1_700_000_000_000,
    });
  });

  it.each<PageHistoryEntry>([
    { kind: 'dashboard', uid: 'abc', pathname: '/x', search: '' },
    { kind: 'folder', uid: 'abc', pathname: '/x', search: '' },
    { kind: 'notebook', uid: 'abc', pathname: '/x', search: '' },
    { kind: 'playlist', uid: 'abc', pathname: '/x', search: '' },
  ])('keeps the uid of a $kind row', (entry) => {
    expect(toPageHistoryItem(entry).uid).toBe('abc');
  });

  it.each<PageHistoryEntry>([
    { kind: 'explore', session: 's1', pathname: '/explore', search: '' },
    { kind: 'page', pathname: '/a/grafana-assistant-app/pages/p1', search: '' },
    { kind: 'alerting', pathname: '/alerting/list', search: '' },
    { kind: 'app', pathname: '/a/some-app', search: '' },
  ])('has no uid for a $kind row', (entry) => {
    expect(toPageHistoryItem(entry).uid).toBeUndefined();
  });

  it('leaves out the query text, the title and the session of a row', () => {
    const item = toPageHistoryItem({
      kind: 'explore',
      session: 's1',
      pathname: '/explore',
      search: '?left={"queries":[{"expr":"cpu_usage"}]}',
      title: 'Explore',
    });

    expect(item).not.toHaveProperty('search');
    expect(item).not.toHaveProperty('title');
    expect(item).not.toHaveProperty('session');
  });

  it('leaves the time out when the row has none', () => {
    const item = toPageHistoryItem({ kind: 'folder', uid: 'f', pathname: '/dashboards/f/f', search: '' });

    expect(item.lastVisited).toBeUndefined();
  });

  it('copies the row, so that changing the item leaves the row as it was', () => {
    const entry: PageHistoryEntry = { kind: 'folder', uid: 'f', pathname: '/dashboards/f/f', search: '', title: 'F' };
    const item = toPageHistoryItem(entry);

    item.pathname = '/changed';

    expect(item).not.toBe(entry);
    expect(entry.pathname).toBe('/dashboards/f/f');
  });
});
