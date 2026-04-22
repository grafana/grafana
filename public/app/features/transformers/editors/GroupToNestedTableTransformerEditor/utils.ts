import { FieldMatcherID } from '@grafana/data';
import {
  type GroupToNestedTableMatcherConfig,
  type GroupToNestedTableTransformerOptionsV2,
} from '@grafana/data/internal';

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
