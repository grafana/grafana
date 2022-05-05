import { FeatureLike } from 'ol/Feature';

import { FeatureRuleConfig, ComparisonOperation } from '../types';

/**
 * Check whether feature has property value that matches rule
 * @param rule - style rule with an operation, property, and value
 * @param feature - feature with properties and values
 * @returns boolean
 */
export const checkFeatureMatchesStyleRule = (rule: FeatureRuleConfig, feature: FeatureLike) => {
  const val = feature.get(rule.property);
  switch (rule.operation) {
    case ComparisonOperation.EQ:
      return `${val}` === `${rule.value}`;
    case ComparisonOperation.NEQ:
      return val !== rule.value;
    case ComparisonOperation.GT:
      return val > rule.value;
    case ComparisonOperation.GTE:
      return val >= rule.value;
    case ComparisonOperation.LT:
      return val < rule.value;
    case ComparisonOperation.LTE:
      return val <= rule.value;
    default:
      return false;
  }
};
