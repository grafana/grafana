import { ComparisonOperation } from '../types';
/**
 * Check whether feature has property value that matches rule
 * @param rule - style rule with an operation, property, and value
 * @param feature - feature with properties and values
 * @returns boolean
 */
export var checkFeatureMatchesStyleRule = function (rule, feature) {
    switch (rule.operation) {
        case ComparisonOperation.EQ:
            return feature.get(rule.property) === rule.value;
        case ComparisonOperation.GT:
            return feature.get(rule.property) > rule.value;
        case ComparisonOperation.GTE:
            return feature.get(rule.property) >= rule.value;
        case ComparisonOperation.LT:
            return feature.get(rule.property) < rule.value;
        case ComparisonOperation.LTE:
            return feature.get(rule.property) <= rule.value;
        default:
            return false;
    }
};
//# sourceMappingURL=checkFeatureMatchesStyleRule.js.map