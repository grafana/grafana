import { type RuleSearchSchema } from './filterDefinitions';
import { parse } from './parser';
import { sharedFilters } from './sharedFilters';
import { type SharedRuleFilter, createEmptyFilter } from './sharedRuleFilter';

// Only the filters both pages share, so these rows hold on either page. Each page's own filters are tested next to
// its schema.
const sharedSchema: RuleSearchSchema<SharedRuleFilter> = {
  filters: Object.values(sharedFilters),
  createEmptyFilter,
};

interface Row {
  name: string;
  query: string;
  filter: Partial<SharedRuleFilter>;
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
    {
      name: 'health in any letter case',
      query: 'health:NoData',
      filter: { health: 'nodata' },
    },
    { name: 'hidden plugin rules', query: 'plugins:hide', filter: { hidePluginRules: true } },
  ])('reads $name', ({ query, filter }) => {
    expect(parse(query, sharedSchema).filter).toEqual({ ...createEmptyFilter(), ...filter });
  });

  it.each([
    ['label:', 'label'],
    ['rule:', 'rule'],
    ['folder:""', 'folder'],
    ['label:=api', 'label'],
    ['label:!', 'label'],
    ['plugins:show', 'plugins'],
    ['health:err', 'health'],
    ['folder:"My Fol', 'folder'],
  ])('rejects %j as an invalid %s value and leaves the filter empty', (query, key) => {
    expect(parse(query, sharedSchema)).toEqual({ filter: createEmptyFilter(), issues: [{ key, reason: 'invalid' }] });
  });

  it.each(['"cpu high', 'foo:"a b'])('rejects the unclosed quote in %j and leaves the filter empty', (query) => {
    expect(parse(query, sharedSchema)).toEqual({
      filter: createEmptyFilter(),
      issues: [{ key: null, reason: 'unclosedQuote' }],
    });
  });
});

describe('feedback', () => {
  it.each(['cpu', 'folder:f1', 'label:team=api', 'label:team=~api.*'])('reports no issues for %j', (query) => {
    expect(parse(query, sharedSchema).issues).toEqual([]);
  });

  it.each([
    ['folder:f*', 'folder'],
    ['datasource:__expr__', 'datasource'],
    ['datasource:"my ds"', 'datasource'],
    ['label:team=a*', 'label'],
    ['label:!!team', 'label'],
    ['label:a=b!=c', 'label'],
  ])('reports %j as an invalid %s filter', (query, key) => {
    expect(parse(query, sharedSchema).issues).toEqual([{ key, reason: 'invalid' }]);
  });

  it.each(['cpu*', '100%'])('reports the wildcard in %j', (query) => {
    expect(parse(query, sharedSchema).issues).toEqual([{ key: null, reason: 'wildcardInText' }]);
  });
});
