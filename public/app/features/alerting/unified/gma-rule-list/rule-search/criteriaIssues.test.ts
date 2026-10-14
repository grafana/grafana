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

  it('reports policy:default as unavailable for Alert, so it is never searched', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), policy: 'default' };
    expect(getCriteriaIssues(criteria, 'alert')).toEqual([{ key: 'policy', reason: 'unavailable' }]);
  });

  it('does not report a named policy', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), policy: 'escalation' };
    expect(getCriteriaIssues(criteria, 'alert')).toEqual([]);
  });

  it.each<[string, Partial<Criteria>, string]>([
    ['a wildcard in the title text', { text: ['cpu*'] }, 'rule'],
    ['a percent sign in the title text', { text: ['100%'] }, 'rule'],
    ['a wildcard in a folder UID', { namespaces: ['f*'] }, 'namespace'],
    ['a data source UID with a space', { dataSourceUids: ['my ds'] }, 'datasource'],
    ['an expression data source UID', { dataSourceUids: ['__expr__'] }, 'datasource'],
    ['a wildcard in an exact label value', { labels: [{ key: 'team', operator: 'equal', value: 'a*' }] }, 'label'],
    ['a negated label key', { labels: [{ key: '!team', operator: 'exists' }] }, 'label'],
    ['a zero panel ID', { dashboardUid: 'dash', panelId: '0' }, 'panelId'],
    ['a non-numeric panel ID', { dashboardUid: 'dash', panelId: 'abc' }, 'panelId'],
  ])('reports %s as invalid', (_name, patch, key) => {
    const criteria: Criteria = { ...createEmptyCriteria(), ...patch };
    expect(getCriteriaIssues(criteria, 'alert')).toEqual([{ key, reason: 'invalid' }]);
  });

  it('allows a literal asterisk inside a label regex', () => {
    const criteria: Criteria = {
      ...createEmptyCriteria(),
      labels: [{ key: 'team', operator: 'regex', value: 'api.*' }],
    };
    expect(getCriteriaIssues(criteria, 'alert')).toEqual([]);
  });

  it('reports a wildcard in the Recording metric as invalid', () => {
    const criteria: Criteria = { ...createEmptyCriteria(), metric: 'cpu_*' };
    expect(getCriteriaIssues(criteria, 'recording')).toEqual([{ key: 'metric', reason: 'invalid' }]);
  });
});
