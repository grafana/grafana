import {
  type GroupToNestedTableMatcherConfig,
  type GroupToNestedTableTransformerOptionsV2,
} from '@grafana/data/internal';
import { FieldMatcherID } from '@grafana/data/transformations';

export const DEFAULT_MATCHER_ID = FieldMatcherID.byName;

export const updateRuleByIndex = (
  options: GroupToNestedTableTransformerOptionsV2,
  index: number,
  newRule: GroupToNestedTableMatcherConfig
): GroupToNestedTableTransformerOptionsV2 => {
  const newRules = options.rules.map((rule, i) => (i === index ? newRule : rule));
  return {
    ...options,
    rules: newRules,
  };
};

export const deleteRuleByIndex = (
  options: GroupToNestedTableTransformerOptionsV2,
  index: number
): GroupToNestedTableTransformerOptionsV2 => {
  const newRules = options.rules.filter((_, i) => i !== index);
  return {
    ...options,
    rules: newRules,
  };
};

export const appendNewRule = (
  options: GroupToNestedTableTransformerOptionsV2
): GroupToNestedTableTransformerOptionsV2 => {
  const newRule: GroupToNestedTableMatcherConfig = {
    matcher: { id: DEFAULT_MATCHER_ID },
    operation: null,
    aggregations: [],
    keepNestedField: true,
  };
  return {
    ...options,
    rules: [...options.rules, newRule],
  };
};

// it is possible for this key to not be unique if there are two rules with identical shapes in the transform,
// so we need to ensure uniqueness when generating the keys by also keeping track of the current list of keys
// and disambiguating when hitting dupes.
export const getRuleKey = (rule: GroupToNestedTableMatcherConfig): string =>
  `${rule.matcher.id}:${JSON.stringify(rule.matcher.options ?? '')}`;
