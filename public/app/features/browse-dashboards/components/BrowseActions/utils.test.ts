import { buildBreakdownString } from './utils';

describe('browse-dashboards utils', () => {
  describe('buildBreakdownString', () => {
    it.each`
      folderCount | dashboardCount | libraryPanelCount | alertRuleCount | expected
      ${0}        | ${0}           | ${0}              | ${0}           | ${'0 items'}
      ${1}        | ${0}           | ${0}              | ${0}           | ${'1 item: 1 folder'}
      ${2}        | ${0}           | ${0}              | ${0}           | ${'2 items: 2 folders'}
      ${0}        | ${1}           | ${0}              | ${0}           | ${'1 item: 1 dashboard'}
      ${0}        | ${2}           | ${0}              | ${0}           | ${'2 items: 2 dashboards'}
      ${1}        | ${0}           | ${1}              | ${1}           | ${'3 items: 1 folder, 1 library panel, 1 alert rule'}
      ${2}        | ${0}           | ${3}              | ${4}           | ${'9 items: 2 folders, 3 library panels, 4 alert rules'}
      ${1}        | ${1}           | ${1}              | ${1}           | ${'4 items: 1 folder, 1 dashboard, 1 library panel, 1 alert rule'}
      ${1}        | ${2}           | ${3}              | ${4}           | ${'10 items: 1 folder, 2 dashboards, 3 library panels, 4 alert rules'}
    `(
      'returns the correct message for the various inputs',
      ({ folderCount, dashboardCount, libraryPanelCount, alertRuleCount, expected }) => {
        expect(buildBreakdownString(folderCount, dashboardCount, libraryPanelCount, alertRuleCount)).toEqual(expected);
      }
    );
  });
});
