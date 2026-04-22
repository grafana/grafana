import { FieldMatcherID } from '@grafana/data';
import { GroupByOperationID, type GroupToNestedTableTransformerOptionsV2 } from '@grafana/data/internal';

import { DEFAULT_MATCHER_ID, appendNewRule, deleteRuleByIndex, updateRuleByIndex } from './utils';

const baseOptions = (): GroupToNestedTableTransformerOptionsV2 => ({
  rules: [
    {
      matcher: { id: FieldMatcherID.byName, options: 'host' },
      operation: GroupByOperationID.groupBy,
      aggregations: [],
    },
    { matcher: { id: FieldMatcherID.byName, options: 'dc' }, operation: null, aggregations: [], keepNestedField: true },
  ],
});

describe('updateRuleByIndex', () => {
  it('replaces the rule at the given index', () => {
    const options = baseOptions();
    const newRule = { matcher: { id: FieldMatcherID.byName, options: 'updated' }, operation: null, aggregations: [] };
    const result = updateRuleByIndex(options, 0, newRule);
    expect(result.rules[0]).toBe(newRule);
    expect(result.rules[1]).toBe(options.rules[1]);
  });

  it('does not mutate the original options', () => {
    const options = baseOptions();
    const original = options.rules.slice();
    updateRuleByIndex(options, 0, { matcher: { id: FieldMatcherID.byName }, operation: null, aggregations: [] });
    expect(options.rules).toEqual(original);
  });

  it('preserves other top-level options fields', () => {
    const options = { ...baseOptions(), someOtherField: 42 } as GroupToNestedTableTransformerOptionsV2 & {
      someOtherField: number;
    };
    const result = updateRuleByIndex(options, 0, {
      matcher: { id: FieldMatcherID.byName },
      operation: null,
      aggregations: [],
    }) as typeof options;
    expect(result.someOtherField).toBe(42);
  });
});

describe('deleteRuleByIndex', () => {
  it('removes the rule at the given index', () => {
    const options = baseOptions();
    const result = deleteRuleByIndex(options, 0);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toBe(options.rules[1]);
  });

  it('does not mutate the original options', () => {
    const options = baseOptions();
    deleteRuleByIndex(options, 0);
    expect(options.rules).toHaveLength(2);
  });

  it('handles deleting the last rule', () => {
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [{ matcher: { id: FieldMatcherID.byName }, operation: null, aggregations: [] }],
    };
    const result = deleteRuleByIndex(options, 0);
    expect(result.rules).toHaveLength(0);
  });
});

describe('appendNewRule', () => {
  it('appends a rule with keepNestedField true', () => {
    const options = baseOptions();
    const result = appendNewRule(options);
    const added = result.rules[result.rules.length - 1];
    expect(added.keepNestedField).toBe(true);
  });

  it('appends a rule with the default matcher id', () => {
    const options = baseOptions();
    const result = appendNewRule(options);
    const added = result.rules[result.rules.length - 1];
    expect(added.matcher.id).toBe(DEFAULT_MATCHER_ID);
  });

  it('appends a rule with empty aggregations and null operation', () => {
    const options = baseOptions();
    const result = appendNewRule(options);
    const added = result.rules[result.rules.length - 1];
    expect(added.aggregations).toEqual([]);
    expect(added.operation).toBeNull();
  });

  it('increases rule count by 1', () => {
    const options = baseOptions();
    const result = appendNewRule(options);
    expect(result.rules).toHaveLength(options.rules.length + 1);
  });

  it('does not mutate the original options', () => {
    const options = baseOptions();
    appendNewRule(options);
    expect(options.rules).toHaveLength(2);
  });
});
