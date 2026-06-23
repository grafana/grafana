import { getFolderIsEmpty, getSelectedFolderUIDs } from './utils';

describe('browse-dashboards utils', () => {
  describe('getSelectedFolderUIDs', () => {
    it('returns only the UIDs of folders that are selected', () => {
      const selection = { folder: { 'folder-a': true, 'folder-b': false, 'folder-c': true } };
      expect(getSelectedFolderUIDs(selection)).toEqual(['folder-a', 'folder-c']);
    });

    it('returns an empty array when nothing is selected', () => {
      expect(getSelectedFolderUIDs({ folder: {} })).toEqual([]);
    });
  });

  describe('getFolderIsEmpty', () => {
    const selection = { folder: { 'folder-a': true }, dashboard: {} };

    it('returns true when the only affected item is the selected folder itself', () => {
      const affected = { folders: 1, dashboards: 0, library_elements: 0, alertrules: 0 };
      expect(getFolderIsEmpty(affected, selection)).toBe(true);
    });

    it('returns false when the selected folder contains a child folder', () => {
      const affected = { folders: 2, dashboards: 0, library_elements: 0, alertrules: 0 };
      expect(getFolderIsEmpty(affected, selection)).toBe(false);
    });

    it('returns false when the selected folder contains a library panel', () => {
      const affected = { folders: 1, dashboards: 0, library_elements: 1, alertrules: 0 };
      expect(getFolderIsEmpty(affected, selection)).toBe(false);
    });

    it('returns false when the selected folder contains an alert rule', () => {
      const affected = { folders: 1, dashboards: 0, library_elements: 0, alertrules: 1 };
      expect(getFolderIsEmpty(affected, selection)).toBe(false);
    });

    it('subtracts selected dashboards so they are not counted as descendants', () => {
      const affected = { folders: 1, dashboards: 1, library_elements: 0, alertrules: 0 };
      const selectionWithDashboard = {
        folder: { 'folder-a': true },
        dashboard: { 'dashboard-a': true },
      };
      expect(getFolderIsEmpty(affected, selectionWithDashboard)).toBe(true);
    });

    it('ignores falsy entries when counting selected items', () => {
      const affected = { folders: 1, dashboards: 0, library_elements: 0, alertrules: 0 };
      const selectionWithDeselected = {
        folder: { 'folder-a': true, 'folder-b': false },
        dashboard: {},
      };
      expect(getFolderIsEmpty(affected, selectionWithDeselected)).toBe(true);
    });

    it('returns true when the affected counts are lower than the selection counts', () => {
      const affected = { folders: 0, dashboards: 0, library_elements: 0, alertrules: 0 };
      expect(getFolderIsEmpty(affected, selection)).toBe(true);
    });
  });
});
