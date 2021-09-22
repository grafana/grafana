import { Feature } from 'ol';
import { Geometry } from 'ol/geom';
import { FeatureRuleConfig, ComparisonOperations } from '../types';

/**
 * Check whether feature has property value that matches rule
 * @param rule - style rule with an operation, property, and value
 * @param feature - feature with properties and values
 * @returns boolean
 */
export const checkFeatureMatchesStyleRule = (rule: FeatureRuleConfig, feature: Feature<Geometry>) => {
  switch (rule.operations) {
    case ComparisonOperations.EQ:
      return feature.get(rule.property) === rule.value;
    case ComparisonOperations.GT:
      return feature.get(rule.property) > rule.value;
    case ComparisonOperations.GTE:
      return feature.get(rule.property) >= rule.value;
    case ComparisonOperations.LT:
      return feature.get(rule.property) < rule.value;
    case ComparisonOperations.LTE:
      return feature.get(rule.property) <= rule.value;
  }
  return false;
};
