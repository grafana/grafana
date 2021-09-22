import { Feature } from 'ol';
import { Geometry } from 'ol/geom';

export interface GeoJSONMapperRule {
  property: string;
  operation: string;
  value: string | boolean | number;
}

/**
 * Check whether feature has property value that matches rule
 * @param rule - style rule with an operation, property, and value
 * @param feature - feature with properties and values
 * @returns boolean
 */
export const checkFeatureMatchesStyleRule = (rule: GeoJSONMapperRule, feature: Feature<Geometry>) => {
  switch (rule.operation) {
    case 'eq':
      return feature.get(rule.property) === rule.value;
    case 'gt':
      return feature.get(rule.property) > rule.value;
    case 'gte':
      return feature.get(rule.property) >= rule.value;
    case 'lt':
      return feature.get(rule.property) < rule.value;
    case 'lte':
      return feature.get(rule.property) <= rule.value;
  }
  return false;
};
