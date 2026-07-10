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

    it('carries the passed icon onto the created child', () => {
      const state = buildState();
      const next = navTreeReducer(
        state,
        setStarred({ id: 'fold1', title: 'My Folder', url: '/dashboards/f/fold1', icon: 'folder', isStarred: true })
      );
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children).toHaveLength(1);
      expect(starred?.children?.[0].icon).toBe('folder');
    });

    it('removes a starred item by prefixed ID', () => {
      const state = buildState([{ id: ID_PREFIX + 'abc', text: 'My Dash', url: '/d/abc' }]);
      const next = navTreeReducer(state, setStarred({ id: 'abc', title: '', url: '', isStarred: false }));
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children).toHaveLength(0);
    });

    it('inserts a starred folder after dashboards even when its title sorts first', () => {
      const state = buildState([
        { id: ID_PREFIX + 'b', text: 'BBB dash', url: '/d/b' },
        { id: ID_PREFIX + 'z', text: 'ZZZ dash', url: '/d/z' },
      ]);
      const next = navTreeReducer(
        state,
        setStarred({ id: 'f1', title: 'AAA folder', url: '/dashboards/f/f1', sortWeight: 1, isStarred: true })
      );
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children?.map((c) => c.text)).toEqual(['BBB dash', 'ZZZ dash', 'AAA folder']);
    });

    it('inserts a starred dashboard before folders even when its title sorts last', () => {
      const state = buildState([
        { id: ID_PREFIX + 'b', text: 'BBB dash', url: '/d/b' },
        { id: ID_PREFIX + 'f1', text: 'AAA folder', url: '/dashboards/f/f1', sortWeight: 1 },
      ]);
      const next = navTreeReducer(state, setStarred({ id: 'z', title: 'ZZZ dash', url: '/d/z', isStarred: true }));
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children?.map((c) => c.text)).toEqual(['BBB dash', 'ZZZ dash', 'AAA folder']);
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

    it('keeps dashboards before folders after rename even when the new title sorts after the folder', () => {
      const state = buildState([
        { id: ID_PREFIX + 'b', text: 'BBB dash', url: '/d/b' },
        { id: ID_PREFIX + 'a', text: 'A dash', url: '/d/a' },
        { id: ID_PREFIX + 'f1', text: 'AAA folder', url: '/dashboards/f/f1', sortWeight: 1 },
      ]);
      const next = navTreeReducer(state, updateDashboardName({ id: 'a', title: 'ZZZ dash', url: '/d/a/zzz-dash' }));
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children?.map((c) => c.text)).toEqual(['BBB dash', 'ZZZ dash', 'AAA folder']);
    });

    it('updates a starred folder row and preserves icon and sortWeight', () => {
      const state = buildState([
        { id: ID_PREFIX + 'd1', text: 'Dash', url: '/d/d1' },
        { id: ID_PREFIX + 'f1', text: 'Old Folder', url: '/dashboards/f/f1/', icon: 'folder', sortWeight: 1 },
      ]);
      const next = navTreeReducer(
        state,
        updateDashboardName({ id: 'f1', title: 'New Folder', url: '/dashboards/f/f1/new' })
      );
      const starred = next.find((n) => n.id === 'starred');
      const folder = starred?.children?.find((c) => c.id === ID_PREFIX + 'f1');
      expect(folder).toMatchObject({ text: 'New Folder', url: '/dashboards/f/f1/new', icon: 'folder', sortWeight: 1 });
      // Dashboards still sort before folders
      expect(starred?.children?.map((c) => c.text)).toEqual(['Dash', 'New Folder']);
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

    it('groups dashboards before folders even when a folder title sorts first', () => {
      const state = buildState();
      const next = navTreeReducer(
        state,
        setStarredItems({
          uids: ['f1', 'b', 'z'],
          items: [
            { id: 'f1', title: 'AAA folder', url: '/dashboards/f/f1', sortWeight: 1 },
            { id: 'b', title: 'BBB dash', url: '/d/b' },
            { id: 'z', title: 'ZZZ dash', url: '/d/z' },
          ],
        })
      );
      const starred = next.find((n) => n.id === 'starred');
      expect(starred?.children?.map((c) => c.text)).toEqual(['BBB dash', 'ZZZ dash', 'AAA folder']);
    });

    it('carries each item icon onto its built child, keyed by uid not position', () => {
      const state = buildState();
      // Titles sort opposite to insertion order, so a positional bug would swap the icons.
      const next = navTreeReducer(
        state,
        setStarredItems({
          uids: ['dash1', 'fold1'],
          items: [
            { id: 'dash1', title: 'Zulu Dash', url: '/d/dash1', icon: 'apps' },
            { id: 'fold1', title: 'Alpha Folder', url: '/dashboards/f/fold1', icon: 'folder' },
          ],
        })
      );
      const starred = next.find((n) => n.id === 'starred');
      const findChild = (uid: string) => starred?.children?.find((c) => c.id === ID_PREFIX + uid);
      expect(findChild('dash1')?.icon).toBe('apps');
      expect(findChild('fold1')?.icon).toBe('folder');
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
