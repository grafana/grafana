import { getFilterIssues } from './filterIssues';
import { type RuleSearchFilter, createEmptyFilter } from './ruleSearchFilter';

describe('getFilterIssues', () => {
  it('reports no issues for a filter with no problems', () => {
    expect(getFilterIssues(createEmptyFilter(), 'alert')).toEqual([]);
  });

  it('reports panelId without a dashboard as requiresDashboard, for Alert only', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), panelId: '4' };
    expect(getFilterIssues(filter, 'alert')).toEqual([{ key: 'panelId', reason: 'requiresDashboard' }]);
  });

  it('panelId paired with a dashboard has no issue', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), panelId: '4', dashboardUid: 'dash-1' };
    expect(getFilterIssues(filter, 'alert')).toEqual([]);
  });

  it('reports each token the page cannot apply, by the key the user typed', () => {
    const filter: RuleSearchFilter = {
      ...createEmptyFilter(),
      invalid: [
        { key: 'foo', raw: 'foo:bar' },
        { key: 'label', raw: 'label:' },
      ],
    };
    expect(getFilterIssues(filter, 'alert')).toEqual([
      { key: 'foo', reason: 'unsupported', raw: 'foo:bar' },
      { key: 'label', reason: 'unsupported', raw: 'label:' },
    ]);
  });

  it('reports policy:default as unavailable for Alert, so it is never searched', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), policy: 'default' };
    expect(getFilterIssues(filter, 'alert')).toEqual([{ key: 'policy', reason: 'unavailable' }]);
  });

  it('does not report a named policy', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), policy: 'escalation' };
    expect(getFilterIssues(filter, 'alert')).toEqual([]);
  });

  it.each<[string, Partial<RuleSearchFilter>, string]>([
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
    const filter: RuleSearchFilter = { ...createEmptyFilter(), ...patch };
    expect(getFilterIssues(filter, 'alert')).toEqual([{ key, reason: 'invalid' }]);
  });

  it('allows a literal asterisk inside a label regex', () => {
    const filter: RuleSearchFilter = {
      ...createEmptyFilter(),
      labels: [{ key: 'team', operator: 'regex', value: 'api.*' }],
    };
    expect(getFilterIssues(filter, 'alert')).toEqual([]);
  });

  it('reports a wildcard in the Recording metric as invalid', () => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), metric: 'cpu_*' };
    expect(getFilterIssues(filter, 'recording')).toEqual([{ key: 'metric', reason: 'invalid' }]);
  });
});
