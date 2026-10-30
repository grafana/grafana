import { parse } from '../rule-search/parser';
import { createEmptyFilter } from '../rule-search/sharedRuleFilter';

import { type AlertRuleFilter, alertRuleSearchSchema } from './alertRuleFilters';

interface Row {
  name: string;
  query: string;
  filter: Partial<AlertRuleFilter>;
}

function alertIssues(query: string) {
  return parse(query, alertRuleSearchSchema).issues;
}

describe('the Alert rules search', () => {
  it.each<Row>([
    { name: "the Recording rules page's key as title text", query: 'metric:cpu', filter: { text: ['metric:cpu'] } },
    { name: 'state in any letter case', query: 'state:FIRING', filter: { state: 'firing' } },
    { name: 'paused in any letter case', query: 'paused:TRUE', filter: { paused: 'true' } },
    { name: 'a dashboard and a panel', query: 'dashboard:d panelId:4', filter: { dashboardUid: 'd', panelId: '4' } },
    { name: 'a contact point with a space', query: 'contactPoint:"on call"', filter: { contactPoint: 'on call' } },
    { name: 'a named policy', query: 'policy:escalation', filter: { policy: 'escalation' } },
    {
      name: "the default tree's name as the default policy",
      query: 'policy:user-defined',
      filter: { policy: 'default' },
    },
    {
      name: 'the last value of a single-value filter',
      query: 'state:firing state:normal',
      filter: { state: 'normal' },
    },
  ])('reads $name', ({ query, filter }) => {
    expect(parse(query, alertRuleSearchSchema).filter).toEqual({ ...createEmptyFilter(), ...filter });
  });

  it.each([
    ['state:bogus', 'state'],
    ['paused:maybe', 'paused'],
  ])('rejects %j as an invalid %s value and leaves the filter empty', (query, key) => {
    expect(parse(query, alertRuleSearchSchema)).toEqual({
      filter: createEmptyFilter(),
      issues: [{ key, reason: 'invalid' }],
    });
  });

  it('rejects a renamed value with the value that replaces it', () => {
    expect(alertIssues('state:Inactive')).toEqual([
      { key: 'state', reason: 'renamed', from: 'Inactive', to: 'normal' },
    ]);
  });

  it('applies a valid value even when an earlier one was rejected', () => {
    expect(parse('state:bogus state:firing', alertRuleSearchSchema)).toMatchObject({
      filter: { state: 'firing' },
      issues: [{ key: 'state', reason: 'invalid' }],
    });
  });

  it.each(['dashboard:d panelId:4', 'policy:p', 'contactPoint:c', 'paused:true'])(
    'reports no issues for %j',
    (query) => {
      expect(alertIssues(query)).toEqual([]);
    }
  );

  it.each([
    ['dashboard:d*', 'dashboard'],
    ['policy:p*', 'policy'],
    ['contactPoint:c*', 'contactPoint'],
    ['panelId:4', 'panelId'],
    ['dashboard:d panelId:0', 'panelId'],
    ['policy:p contactPoint:c', 'contactPoint'],
  ])('reports %j as an invalid %s filter', (query, key) => {
    expect(alertIssues(query)).toEqual([{ key, reason: 'invalid' }]);
  });

  it.each([
    ['policy:default', 'policy'],
    ['paused:false', 'paused'],
  ])('reports %j as an unavailable %s filter', (query, key) => {
    expect(alertIssues(query)).toEqual([{ key, reason: 'unavailable' }]);
  });
});
