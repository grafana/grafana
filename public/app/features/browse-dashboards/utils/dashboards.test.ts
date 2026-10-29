import { getSelectedItemRefs, getSelectedUIDs } from './dashboards';

describe('browse-dashboards selection helpers', () => {
  const selection = {
    folder: { 'folder-a': true, 'folder-b': false, 'folder-c': true },
    dashboard: { 'dash-a': false, 'dash-b': true },
  };

  describe('getSelectedUIDs', () => {
    it('returns only the UIDs of the requested kind that are selected', () => {
      expect(getSelectedUIDs(selection, 'folder')).toEqual(['folder-a', 'folder-c']);
      expect(getSelectedUIDs(selection, 'dashboard')).toEqual(['dash-b']);
    });

    it('returns an empty array when nothing is selected', () => {
      expect(getSelectedUIDs({ folder: {}, dashboard: {} }, 'folder')).toEqual([]);
    });
  });

  describe('getSelectedItemRefs', () => {
    it('lists selected folders before selected dashboards', () => {
      expect(getSelectedItemRefs(selection)).toEqual([
        { kind: 'folder', uid: 'folder-a' },
        { kind: 'folder', uid: 'folder-c' },
        { kind: 'dashboard', uid: 'dash-b' },
      ]);
    });
  });
});
