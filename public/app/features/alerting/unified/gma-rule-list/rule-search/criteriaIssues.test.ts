import { type Criteria, createEmptyCriteria } from './criteria';
import { getCriteriaIssues } from './criteriaIssues';

describe('getCriteriaIssues', () => {
  it('SEARCH-3.19: reports no issues for a criteria with no problems', () => {
    expect(getCriteriaIssues(createEmptyCriteria(), 'alert')).toEqual([]);
  });

  it('SEARCH-3.20: reports panelId without a dashboard as requiresDashboard, for Alert only', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), panelId: '4' };
    expect(getCriteriaIssues(criteria, 'alert')).toEqual([{ key: 'panelId', reason: 'requiresDashboard' }]);
  });

  it('SEARCH-3.21: panelId paired with a dashboard has no issue', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), panelId: '4', dashboardUid: 'dash-1' };
    expect(getCriteriaIssues(criteria, 'alert')).toEqual([]);
  });

  it('NAV-4.11: reports each unresolved migration entry with its key and original value', () => {
    const criteria: Criteria = {
      ...createEmptyCriteria(),
      unresolved: [
        { key: 'namespace', value: 'Unknown Folder' },
        { key: 'datasource', value: 'unknown-ds' },
      ],
    };
    expect(getCriteriaIssues(criteria, 'alert')).toEqual([
      { key: 'namespace', reason: 'unresolved', value: 'Unknown Folder' },
      { key: 'datasource', reason: 'unresolved', value: 'unknown-ds' },
    ]);
  });
});
