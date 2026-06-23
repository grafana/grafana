import { type NavModelItem } from '@grafana/data';

import { ID_PREFIX, navTreeReducer, setStarred, setStarredItems, updateDashboardName } from './navBarTree';

function buildState(starredChildren: NavModelItem[] = []): NavModelItem[] {
  return [
    { id: 'home', text: 'Home', url: '/' },
    { id: 'starred', text: 'Starred', children: starredChildren },
  ];
}

describe('navBarTree reducer', () => {
  describe('setStarred', () => {
    it('adds a starred item with the ID_PREFIX', () => {
      const state = buildState();
      const next = navTreeReducer(state, setStarred({ id: 'abc', title: 'My Dash', url: '/d/abc', isStarred: true }));
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children).toHaveLength(1);
      expect(starred?.children?.[0]).toMatchObject({ id: 'starred/abc', text: 'My Dash', url: '/d/abc' });
    });

    it('removes a starred item by prefixed ID', () => {
      const state = buildState([{ id: ID_PREFIX + 'abc', text: 'My Dash', url: '/d/abc' }]);
      const next = navTreeReducer(state, setStarred({ id: 'abc', title: '', url: '', isStarred: false }));
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children).toHaveLength(0);
    });
  });

  describe('updateDashboardName', () => {
    it('updates a starred item matching ID_PREFIX + id', () => {
      const state = buildState([{ id: ID_PREFIX + 'abc', text: 'Old Name', url: '/d/abc/old-name' }]);
      const next = navTreeReducer(state, updateDashboardName({ id: 'abc', title: 'New Name', url: '/d/abc/new-name' }));
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children?.[0]).toMatchObject({
        id: 'starred/abc',
        text: 'New Name',
        url: '/d/abc/new-name',
      });
    });

    it('no-ops when the dashboard is not starred', () => {
      const state = buildState([{ id: ID_PREFIX + 'other', text: 'Other Dash', url: '/d/other' }]);
      const next = navTreeReducer(state, updateDashboardName({ id: 'abc', title: 'New Name', url: '/d/abc/new-name' }));
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children).toHaveLength(1);
      expect(starred?.children?.[0]).toMatchObject({ id: 'starred/other', text: 'Other Dash', url: '/d/other' });
    });

    it('re-sorts children after rename', () => {
      const state = buildState([
        { id: ID_PREFIX + 'a', text: 'Alpha', url: '/d/a' },
        { id: ID_PREFIX + 'b', text: 'Beta', url: '/d/b' },
        { id: ID_PREFIX + 'c', text: 'Charlie', url: '/d/c' },
      ]);
      // Rename 'Alpha' to 'Zulu' — should move to end
      const next = navTreeReducer(state, updateDashboardName({ id: 'a', title: 'Zulu', url: '/d/a/zulu' }));
      const starred = next.find((n) => n.id === 'starred');
      const names = starred?.children?.map((c) => c.text);
      expect(names).toEqual(['Beta', 'Charlie', 'Zulu']);
    });
  });

  describe('setStarredItems', () => {
    it('replaces children with sorted items', () => {
      const state = buildState([{ id: ID_PREFIX + 'old', text: 'Old Dash', url: '/d/old' }]);
      const next = navTreeReducer(
        state,
        setStarredItems({
          uids: ['c', 'a', 'b'],
          items: [
            { id: 'c', title: 'Charlie', url: '/d/c' },
            { id: 'a', title: 'Alpha', url: '/d/a' },
            { id: 'b', title: 'Beta', url: '/d/b' },
          ],
        })
      );
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children).toHaveLength(3);
      expect(starred?.children?.map((c) => c.text)).toEqual(['Alpha', 'Beta', 'Charlie']);
      expect(starred?.children?.map((c) => c.id)).toEqual(['starred/a', 'starred/b', 'starred/c']);
    });

    it('clears previous children', () => {
      const state = buildState([
        { id: ID_PREFIX + 'x', text: 'X', url: '/d/x' },
        { id: ID_PREFIX + 'y', text: 'Y', url: '/d/y' },
      ]);
      const next = navTreeReducer(state, setStarredItems({ uids: [], items: [] }));
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children).toEqual([]);
    });

    it('keeps the existing child for a starred uid missing from the search response', () => {
      const state = buildState([{ id: ID_PREFIX + 'fresh', text: 'Fresh Dash', url: '/d/fresh' }]);
      const next = navTreeReducer(
        state,
        setStarredItems({
          uids: ['a', 'fresh'],
          items: [{ id: 'a', title: 'Alpha', url: '/d/a' }],
        })
      );
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children?.map((c) => c.text)).toEqual(['Alpha', 'Fresh Dash']);
    });

    it('drops unstarred uids even when search misses them', () => {
      const state = buildState([{ id: ID_PREFIX + 'gone', text: 'Gone Dash', url: '/d/gone' }]);
      const next = navTreeReducer(
        state,
        setStarredItems({ uids: ['a'], items: [{ id: 'a', title: 'Alpha', url: '/d/a' }] })
      );
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children?.map((c) => c.text)).toEqual(['Alpha']);
    });

    it('no-ops when starred section is missing', () => {
      const state = [{ id: 'home', text: 'Home', url: '/' }];
      const next = navTreeReducer(
        state,
        setStarredItems({ uids: ['a'], items: [{ id: 'a', title: 'A', url: '/d/a' }] })
      );
      expect(next).toEqual(state);
    });
  });
});
