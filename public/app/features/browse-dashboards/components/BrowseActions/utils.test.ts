import { buildBreakdownString, getFolderIsEmpty } from './utils';

describe('browse-dashboards utils', () => {
  describe('buildBreakdownString', () => {
    // note: pluralisation is handled as part of the i18n framework
    // in tests, only the fallback singular message is used
    it.each`
      folderCount | dashboardCount | libraryPanelCount | alertRuleCount | expected
      ${0}        | ${0}           | ${0}              | ${0}           | ${'0 item'}
      ${1}        | ${0}           | ${0}              | ${0}           | ${'1 item: 1 folder'}
      ${2}        | ${0}           | ${0}              | ${0}           | ${'2 item: 2 folder'}
      ${0}        | ${1}           | ${0}              | ${0}           | ${'1 item: 1 dashboard'}
      ${0}        | ${2}           | ${0}              | ${0}           | ${'2 item: 2 dashboard'}
      ${1}        | ${0}           | ${1}              | ${1}           | ${'3 item: 1 folder, 1 library panel, 1 alert rule'}
      ${2}        | ${0}           | ${3}              | ${4}           | ${'9 item: 2 folder, 3 library panel, 4 alert rule'}
      ${1}        | ${1}           | ${1}              | ${1}           | ${'4 item: 1 folder, 1 dashboard, 1 library panel, 1 alert rule'}
      ${1}        | ${2}           | ${3}              | ${4}           | ${'10 item: 1 folder, 2 dashboard, 3 library panel, 4 alert rule'}
    `(
      'returns the correct message for the various inputs',
      ({ folderCount, dashboardCount, libraryPanelCount, alertRuleCount, expected }) => {
        expect(buildBreakdownString(folderCount, dashboardCount, libraryPanelCount, alertRuleCount)).toEqual(expected);
      }
    );
  });

  describe('getFolderIsEmpty', () => {
    const selection = { folder: { 'folder-a': true }, dashboard: {} };

    it('returns undefined when affected items have not loaded yet', () => {
      expect(getFolderIsEmpty(undefined, selection)).toBeUndefined();
    });

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
  });
});
