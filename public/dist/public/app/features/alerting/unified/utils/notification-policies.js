import { isArray, merge, pick, reduce } from 'lodash';
import { MatcherOperator, } from 'app/plugins/datasource/alertmanager/types';
import { normalizeMatchers } from './matchers';
const OperatorFunctions = {
    [MatcherOperator.equal]: (lv, mv) => lv === mv,
    [MatcherOperator.notEqual]: (lv, mv) => lv !== mv,
    [MatcherOperator.regex]: (lv, mv) => Boolean(lv.match(new RegExp(mv))),
    [MatcherOperator.notRegex]: (lv, mv) => !Boolean(lv.match(new RegExp(mv))),
};
function isLabelMatch(matcher, label) {
    const [labelKey, labelValue] = label;
    const [matcherKey, operator, matcherValue] = matcher;
    // not interested, keys don't match
    if (labelKey !== matcherKey) {
        return false;
    }
    const matchFunction = OperatorFunctions[operator];
    if (!matchFunction) {
        throw new Error(`no such operator: ${operator}`);
    }
    return matchFunction(labelValue, matcherValue);
}
// check if every matcher returns "true" for the set of labels
function matchLabels(matchers, labels) {
    const details = new Map();
    // If a policy has no matchers it still can be a match, hence matchers can be empty and match can be true
    // So we cannot use empty array of matchers as an indicator of no match
    const labelsMatch = new Map(labels.map((label) => [label, { match: false, matchers: [] }]));
    const matches = matchers.every((matcher) => {
        const matchingLabels = labels.filter((label) => isLabelMatch(matcher, label));
        matchingLabels.forEach((label) => {
            const labelMatch = labelsMatch.get(label);
            // The condition is just to satisfy TS. The map should have all the labels due to the previous map initialization
            if (labelMatch) {
                labelMatch.match = true;
                labelMatch.matchers.push(matcher);
            }
        });
        if (matchingLabels.length === 0) {
            return false;
        }
        details.set(matcher, matchingLabels);
        return matchingLabels.length > 0;
    });
    return { matches, details, labelsMatch };
}
// Match does a depth-first left-to-right search through the route tree
// and returns the matching routing nodes.
// If the current node is not a match, return nothing
// const normalizedMatchers = normalizeMatchers(root);
// Normalization should have happened earlier in the code
function findMatchingRoutes(root, labels) {
    var _a;
    let matches = [];
    // If the current node is not a match, return nothing
    const matchResult = matchLabels((_a = root.object_matchers) !== null && _a !== void 0 ? _a : [], labels);
    if (!matchResult.matches) {
        return [];
    }
    // If the current node matches, recurse through child nodes
    if (root.routes) {
        for (let index = 0; index < root.routes.length; index++) {
            let child = root.routes[index];
            let matchingChildren = findMatchingRoutes(child, labels);
            // TODO how do I solve this typescript thingy? It looks correct to me /shrug
            // @ts-ignore
            matches = matches.concat(matchingChildren);
            // we have matching children and we don't want to continue, so break here
            if (matchingChildren.length && !child.continue) {
                break;
            }
        }
    }
    // If no child nodes were matches, the current node itself is a match.
    if (matches.length === 0) {
        matches.push({ route: root, details: matchResult.details, labelsMatch: matchResult.labelsMatch });
    }
    return matches;
}
// This is a performance improvement to normalize matchers only once and use the normalized version later on
export function normalizeRoute(rootRoute) {
    function normalizeRoute(route) {
        var _a;
        route.object_matchers = normalizeMatchers(route);
        delete route.matchers;
        delete route.match;
        delete route.match_re;
        (_a = route.routes) === null || _a === void 0 ? void 0 : _a.forEach(normalizeRoute);
    }
    const normalizedRootRoute = structuredClone(rootRoute);
    normalizeRoute(normalizedRootRoute);
    return normalizedRootRoute;
}
/**
 * find all of the groups that have instances that match the route, thay way we can find all instances
 * (and their grouping) for the given route
 */
function findMatchingAlertGroups(routeTree, route, alertGroups) {
    const matchingGroups = [];
    return alertGroups.reduce((acc, group) => {
        // find matching alerts in the current group
        const matchingAlerts = group.alerts.filter((alert) => {
            const labels = Object.entries(alert.labels);
            return findMatchingRoutes(routeTree, labels).some((matchingRoute) => matchingRoute.route === route);
        });
        // if the groups has any alerts left after matching, add it to the results
        if (matchingAlerts.length) {
            acc.push(Object.assign(Object.assign({}, group), { alerts: matchingAlerts }));
        }
        return acc;
    }, matchingGroups);
}
// inherited properties are config properties that exist on the parent route (or its inherited properties) but not on the child route
function getInheritedProperties(parentRoute, childRoute, propertiesParentInherited) {
    const fullParentProperties = merge({}, parentRoute, propertiesParentInherited);
    const inheritableProperties = pick(fullParentProperties, [
        'receiver',
        'group_by',
        'group_wait',
        'group_interval',
        'repeat_interval',
        'mute_time_intervals',
    ]);
    // TODO how to solve this TypeScript mystery?
    const inherited = reduce(inheritableProperties, (inheritedProperties = {}, parentValue, property) => {
        var _a;
        const parentHasValue = parentValue !== undefined;
        // @ts-ignore
        const inheritFromParentUndefined = parentHasValue && childRoute[property] === undefined;
        // @ts-ignore
        const inheritFromParentEmptyString = parentHasValue && childRoute[property] === '';
        const inheritEmptyGroupByFromParent = property === 'group_by' &&
            parentHasValue &&
            isArray(childRoute[property]) &&
            ((_a = childRoute[property]) === null || _a === void 0 ? void 0 : _a.length) === 0;
        const inheritFromParent = inheritFromParentUndefined || inheritFromParentEmptyString || inheritEmptyGroupByFromParent;
        if (inheritFromParent) {
            // @ts-ignore
            inheritedProperties[property] = parentValue;
        }
        return inheritedProperties;
    }, {});
    return inherited;
}
/**
 * This function will compute the full tree with inherited properties – this is mostly used for search and filtering
 */
export function computeInheritedTree(parent) {
    var _a;
    return Object.assign(Object.assign({}, parent), { routes: (_a = parent.routes) === null || _a === void 0 ? void 0 : _a.map((child) => {
            const inheritedProperties = getInheritedProperties(parent, child);
            return computeInheritedTree(Object.assign(Object.assign({}, child), inheritedProperties));
        }) });
}
export { findMatchingAlertGroups, findMatchingRoutes, getInheritedProperties };
//# sourceMappingURL=notification-policies.js.map