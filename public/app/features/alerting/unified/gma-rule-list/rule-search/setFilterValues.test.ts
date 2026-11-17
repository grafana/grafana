import { type RuleSearchSchema } from './filterDefinitions';
import { parse } from './parser';
import { setFilterValues } from './setFilterValues';
import { type SharedFilterKey, formatLabelMatcher, sharedFilters } from './sharedFilters';
import { type SharedRuleFilter, createRulesApiFilter } from './sharedRuleFilter';

const sharedSchema: RuleSearchSchema<SharedRuleFilter, SharedFilterKey> = {
  filters: Object.values(sharedFilters),
  createEmptyFilter: createRulesApiFilter,
};

function set(query: string, key: SharedFilterKey, values: string[]) {
  return setFilterValues(query, sharedSchema, key, values);
}

describe('setFilterValues', () => {
  it.each<[string, string, SharedFilterKey, string[], string]>([
    [
      'replaces a filter in place',
      'cpu health:error  label:team=api',
      'health',
      ['nodata'],
      'cpu health:nodata  label:team=api',
    ],
    ['appends a filter the query lacks', 'cpu  high', 'health', ['error'], 'cpu  high health:error'],
    ['writes into an empty query', '', 'folder', ['f1', 'f2'], 'folder:f1 folder:f2'],
    ['keeps a trailing space as typed', 'cpu ', 'health', ['error'], 'cpu health:error'],
    [
      'puts all values where the first token was',
      'folder:a cpu folder:b health:ok',
      'folder',
      ['c', 'd'],
      'folder:c folder:d cpu health:ok',
    ],
    ['removes a filter from the middle', 'cpu health:error high', 'health', [], 'cpu high'],
    ['removes a leading filter', 'health:error  cpu', 'health', [], 'cpu'],
    ['removes a trailing filter', 'cpu health:error', 'health', [], 'cpu'],
    ['removes the only filter', 'health:error', 'health', [], ''],
    ['replaces a rejected value', 'health:bogus cpu', 'health', ['ok'], 'health:ok cpu'],
    ['quotes a value with spaces', 'cpu', 'datasource', ['a b'], 'cpu datasource:"a b"'],
    ['skips empty values', 'cpu', 'folder', ['', 'f1'], 'cpu folder:f1'],
  ])('%s', (_, query, key, values, expected) => {
    expect(set(query, key, values)).toBe(expected);
  });

  describe('title text', () => {
    it('replaces free text, rule: and unknown keys, keeping filters as typed', () => {
      expect(set('cpu health:error rule:high foo:bar  label:a', 'rule', ['disk full'])).toBe(
        'disk full health:error  label:a'
      );
    });

    it('quotes words that would read as a filter', () => {
      expect(set('health:error', 'rule', ['health:ok cpu'])).toBe('health:error "health:ok" cpu');
    });

    it('removes all title text', () => {
      expect(set('cpu "high load" health:error', 'rule', ['  '])).toBe('health:error');
    });
  });

  it.each([
    { key: 'team', operator: 'exists' as const },
    { key: 'team', operator: 'absent' as const },
    { key: 'team', operator: 'equal' as const, value: 'a b' },
    { key: 'team', operator: 'notEqual' as const, value: 'api' },
    { key: 'team', operator: 'regex' as const, value: 'api.*' },
    { key: 'team', operator: 'notRegex' as const, value: 'api.*' },
  ])('writes the $operator label matcher so it parses back', (matcher) => {
    const query = set('cpu', 'label', [formatLabelMatcher(matcher)]);

    expect(parse(query, sharedSchema).filter.labels).toEqual([matcher]);
    expect(parse(query, sharedSchema).filter.text).toEqual(['cpu']);
  });
});
