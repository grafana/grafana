import { type AlertRuleFilter, alertRuleSearchSchema } from '../alert-rules/alertRuleFilters';
import { type RecordingRuleFilter, recordingRuleSearchSchema } from '../recording-rules/recordingRuleFilters';

import { parse } from './parser';
import { createEmptyFilter } from './sharedRuleFilter';

interface Row {
  name: string;
  query: string;
  filter: Partial<AlertRuleFilter & RecordingRuleFilter>;
}

describe('parsing', () => {
  it.each<Row>([
    { name: 'an empty query', query: '', filter: {} },
    {
      name: 'free text split on whitespace, including a non-breaking space',
      query: '  cpu   high\u00a0disk ',
      filter: { text: ['cpu', 'high', 'disk'] },
    },
    { name: 'quoted free text as one word', query: '"cpu high"', filter: { text: ['cpu high'] } },
    { name: 'a colon with no key as free text', query: '1:2:3', filter: { text: ['1:2:3'] } },
    { name: 'empty quotes as no text', query: '""', filter: {} },
    { name: 'a backslash as an ordinary character', query: '"web\\.prod"', filter: { text: ['web\\.prod'] } },
    {
      name: 'a backslash before a quote without escaping it, so the quote still ends the quoted part',
      query: '"say \\"hi\\""',
      filter: { text: ['say \\hi\\'] },
    },
    {
      name: 'rule: as title text',
      query: 'rule:cpu rule:disk',
      filter: { text: ['cpu', 'disk'] },
    },
    {
      name: 'quoted text that reads as a filter as title text',
      query: '"state:firing"',
      filter: { text: ['state:firing'] },
    },
    { name: 'a key the page has no filter for as title text', query: 'foo:bar', filter: { text: ['foo:bar'] } },
    { name: "the Recording rules page's key as title text", query: 'metric:cpu', filter: { text: ['metric:cpu'] } },
    { name: 'a key in another letter case as title text', query: 'State:firing', filter: { text: ['State:firing'] } },
    {
      name: 'title text with an unknown key and a space',
      query: 'foo:"a b"',
      filter: { text: ['foo:a b'] },
    },
    { name: 'several folders', query: 'folder:f1 folder:"My Folder"', filter: { folders: ['f1', 'My Folder'] } },
    {
      name: 'several data sources',
      query: 'datasource:ds-1 datasource:ds-2',
      filter: { dataSourceUids: ['ds-1', 'ds-2'] },
    },
    { name: 'a label that exists', query: 'label:team', filter: { labels: [{ key: 'team', operator: 'exists' }] } },
    { name: 'a label that is absent', query: 'label:!team', filter: { labels: [{ key: 'team', operator: 'absent' }] } },
    {
      name: 'a label equal to a value',
      query: 'label:team=api',
      filter: { labels: [{ key: 'team', operator: 'equal', value: 'api' }] },
    },
    {
      name: 'a label not equal to a value',
      query: 'label:team!=api',
      filter: { labels: [{ key: 'team', operator: 'notEqual', value: 'api' }] },
    },
    {
      name: 'a label matching a regex',
      query: 'label:team=~api.*',
      filter: { labels: [{ key: 'team', operator: 'regex', value: 'api.*' }] },
    },
    {
      name: 'a label not matching a regex',
      query: 'label:team!~api.*',
      filter: { labels: [{ key: 'team', operator: 'notRegex', value: 'api.*' }] },
    },
    {
      name: 'the earliest label operator',
      query: 'label:a=b!=c',
      filter: { labels: [{ key: 'a', operator: 'equal', value: 'b!=c' }] },
    },
    {
      name: 'a quote inside a label value',
      query: 'label:team="a b"',
      filter: { labels: [{ key: 'team', operator: 'equal', value: 'a b' }] },
    },
    {
      name: 'an empty label value as any value',
      query: 'label:team=',
      filter: { labels: [{ key: 'team', operator: 'exists' }] },
    },
    {
      name: 'an empty not-equal label value',
      query: 'label:team!=',
      filter: { labels: [{ key: 'team', operator: 'notEqual', value: '' }] },
    },
    { name: 'state in any letter case', query: 'state:FIRING', filter: { state: 'firing' } },
    {
      name: 'health in any letter case',
      query: 'health:NoData',
      filter: { health: 'nodata' },
    },
    { name: 'paused in any letter case', query: 'paused:TRUE', filter: { paused: 'true' } },
    { name: 'hidden plugin rules', query: 'plugins:hide', filter: { hidePluginRules: true } },
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
  ])('reads $name on the Alert rules page', ({ query, filter }) => {
    expect(parse(query, alertRuleSearchSchema).filter).toEqual({ ...createEmptyFilter(), ...filter });
  });

  it.each<Row>([
    { name: 'a metric', query: 'metric:cpu', filter: { metric: 'cpu' } },
    { name: 'a target data source', query: 'targetDatasource:ds-2', filter: { targetDataSourceUid: 'ds-2' } },
    { name: 'health:ok', query: 'health:ok', filter: { health: 'ok' } },
    { name: "the Alert rules page's keys as title text", query: 'state:firing', filter: { text: ['state:firing'] } },
  ])('reads $name on the Recording rules page', ({ query, filter }) => {
    expect(parse(query, recordingRuleSearchSchema).filter).toEqual({ ...createEmptyFilter(), ...filter });
  });

  it.each([
    ['state:bogus', 'state'],
    ['label:', 'label'],
    ['rule:', 'rule'],
    ['folder:""', 'folder'],
    ['label:=api', 'label'],
    ['label:!', 'label'],
    ['paused:maybe', 'paused'],
    ['plugins:show', 'plugins'],
    ['health:err', 'health'],
    ['folder:"My Fol', 'folder'],
  ])('rejects %j as an invalid %s value and leaves the filter empty', (query, key) => {
    expect(parse(query, alertRuleSearchSchema)).toEqual({
      filter: createEmptyFilter(),
      issues: [{ key, reason: 'invalid' }],
    });
  });

  it.each(['"cpu high', 'foo:"a b'])('rejects the unclosed quote in %j and leaves the filter empty', (query) => {
    expect(parse(query, alertRuleSearchSchema)).toEqual({
      filter: createEmptyFilter(),
      issues: [{ key: null, reason: 'unclosedQuote' }],
    });
  });

  it('rejects a renamed value with the value that replaces it', () => {
    expect(parse('state:Inactive', alertRuleSearchSchema).issues).toEqual([
      { key: 'state', reason: 'renamed', from: 'Inactive', to: 'normal' },
    ]);
  });

  it('applies a valid value even when an earlier one was rejected', () => {
    expect(parse('state:bogus state:firing', alertRuleSearchSchema)).toMatchObject({
      filter: { state: 'firing' },
      issues: [{ key: 'state', reason: 'invalid' }],
    });
  });
});

function alertIssues(query: string) {
  return parse(query, alertRuleSearchSchema).issues;
}

describe('feedback', () => {
  it.each([
    'cpu',
    'folder:f1',
    'label:team=api',
    'label:team=~api.*',
    'dashboard:d panelId:4',
    'policy:p',
    'contactPoint:c',
    'paused:true',
  ])('reports no issues for %j', (query) => {
    expect(alertIssues(query)).toEqual([]);
  });

  it.each([
    ['folder:f*', 'folder'],
    ['dashboard:d*', 'dashboard'],
    ['policy:p*', 'policy'],
    ['contactPoint:c*', 'contactPoint'],
    ['datasource:__expr__', 'datasource'],
    ['datasource:"my ds"', 'datasource'],
    ['label:team=a*', 'label'],
    ['label:!!team', 'label'],
    ['label:a=b!=c', 'label'],
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

  it.each(['cpu*', '100%'])('reports the wildcard in %j', (query) => {
    expect(alertIssues(query)).toEqual([{ key: null, reason: 'wildcardInText' }]);
  });

  it.each([
    ['metric:cpu_*', 'metric'],
    ['targetDatasource:t*', 'targetDatasource'],
  ])('reports %j as an invalid %s filter on the Recording rules page', (query, key) => {
    expect(parse(query, recordingRuleSearchSchema).issues).toEqual([{ key, reason: 'invalid' }]);
  });
});
