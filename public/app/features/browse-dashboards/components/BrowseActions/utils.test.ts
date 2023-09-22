import { buildBreakdownString } from './utils';

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
});
