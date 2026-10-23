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
      { key: 'foo', reason: 'unsupported' },
      { key: 'label', reason: 'unsupported' },
    ]);
  });

  it.each<[string, Partial<RuleSearchFilter>, string]>([
    ['the default policy', { policy: 'default' }, 'policy'],
    ['not paused', { paused: 'false' }, 'paused'],
  ])('reports %s as unavailable for Alert, so it is never searched', (_name, patch, key) => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), ...patch };
    expect(getFilterIssues(filter, 'alert')).toEqual([{ key, reason: 'unavailable' }]);
  });

  it.each<[string, Partial<RuleSearchFilter>]>([
    ['a named policy', { policy: 'escalation' }],
    ['paused', { paused: 'true' }],
  ])('does not report %s', (_name, patch) => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), ...patch };
    expect(getFilterIssues(filter, 'alert')).toEqual([]);
  });

  it.each<[string, Partial<RuleSearchFilter>, string]>([
    ['a wildcard in a folder UID', { folders: ['f*'] }, 'folder'],
    ['a data source UID with a space', { dataSourceUids: ['my ds'] }, 'datasource'],
    ['an expression data source UID', { dataSourceUids: ['__expr__'] }, 'datasource'],
    ['a wildcard in an exact label value', { labels: [{ key: 'team', operator: 'equal', value: 'a*' }] }, 'label'],
    ['a negated label key', { labels: [{ key: '!team', operator: 'exists' }] }, 'label'],
    ['a zero panel ID', { dashboardUid: 'dash', panelId: '0' }, 'panelId'],
    ['a non-numeric panel ID', { dashboardUid: 'dash', panelId: 'abc' }, 'panelId'],
    ['a contact point next to a policy', { policy: 'escalation', contactPoint: 'on-call' }, 'contactPoint'],
  ])('reports %s as invalid', (_name, patch, key) => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), ...patch };
    expect(getFilterIssues(filter, 'alert')).toEqual([{ key, reason: 'invalid' }]);
  });

  it.each<[string, string]>([
    ['a wildcard', 'cpu*'],
    ['a percent sign', '100%'],
  ])('reports %s in the title text as a wildcard in text', (_name, word) => {
    const filter: RuleSearchFilter = { ...createEmptyFilter(), text: [word] };
    expect(getFilterIssues(filter, 'alert')).toEqual([{ key: 'rule', reason: 'wildcardInText' }]);
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
