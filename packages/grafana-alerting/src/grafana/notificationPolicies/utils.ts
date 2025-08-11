import { groupBy, isArray, pick, reduce, uniqueId } from 'lodash';

import { Label } from '../matchers/types';
import { LabelMatchDetails, matchLabels } from '../matchers/utils';

import { Route } from './types';

export const INHERITABLE_KEYS = ['receiver', 'group_by', 'group_wait', 'group_interval', 'repeat_interval'] as const;
export type InheritableKeys = typeof INHERITABLE_KEYS;
export type InheritableProperties = Pick<Route, InheritableKeys[number]>;

<<<<<<< HEAD
export interface RouteMatchResult<T> {
=======
// Represents matching information for a single route in the traversal path
export type RouteMatchInfo<T extends Route> = {
  route: T;
  matchDetails: LabelMatchDetails[];
  matched: boolean;
};

export interface RouteMatchResult<T extends Route> {
>>>>>>> alerting/pkg-add-route-matching-hook
  route: T;
  labels: Label[];
  // Track matching information for each route in the traversal path
  matchingJourney: Array<RouteMatchInfo<T>>;
}

// Normalization should have happened earlier in the code
export function findMatchingRoutes<T extends Route>(
  route: T, 
  labels: Label[], 
  matchingJourney: Array<RouteMatchInfo<T>> = []
): Array<RouteMatchResult<T>> {
  let childMatches: Array<RouteMatchResult<T>> = [];

  // Check if the current node matches
  const matchResult = matchLabels(route.matchers ?? [], labels);
  
  // Create matching info for this route
  const currentMatchInfo: RouteMatchInfo<T> = {
    route,
    matchDetails: matchResult.details,
    matched: matchResult.matches,
  };
  
  // Add current route's matching info to the journey
  const currentMatchingJourney = [...matchingJourney, currentMatchInfo];

  // If the current node is not a match, return nothing
  if (!matchResult.matches) {
    return [];
  }

  // If the current node matches, recurse through child nodes
  if (route.routes) {
    for (const child of route.routes) {
      const matchingChildren = findMatchingRoutes(child, labels, currentMatchingJourney);
      // TODO how do I solve this typescript thingy? It looks correct to me /shrug
      // @ts-ignore
      childMatches = childMatches.concat(matchingChildren);
      // we have matching children and we don't want to continue, so break here
      if (matchingChildren.length && !child.continue) {
        break;
      }
    }
  }

  // If no child nodes were matches, the current node itself is a match.
  if (childMatches.length === 0) {
    childMatches.push({ 
      route, 
      labels, 
      matchingJourney: currentMatchingJourney
    });
  }

  return childMatches;
}

/**
 * This function will compute the full tree with inherited properties – this is mostly used for search and filtering
 */
export function computeInheritedTree<T extends Route>(parent: T): T {
  return {
    ...parent,
    routes: parent.routes?.map((child) => {
      const inheritedProperties = getInheritedProperties(parent, child);

      return computeInheritedTree({
        ...child,
        ...inheritedProperties,
      });
    }),
  };
}

// inherited properties are config properties that exist on the parent route (or its inherited properties) but not on the child route
export function getInheritedProperties(
  parentRoute: Route,
  childRoute: Route,
  propertiesParentInherited?: InheritableProperties
): InheritableProperties {
  const propsFromParent: InheritableProperties = pick(parentRoute, INHERITABLE_KEYS);
  const inheritableProperties: InheritableProperties = {
    ...propsFromParent,
    ...propertiesParentInherited,
  } as const;

  // @ts-expect-error we're using "keyof" for the property so the type checker can help us out but this makes the
  // reduce function signature unhappy
  const inherited = reduce(
    inheritableProperties,
    (inheritedProperties: InheritableProperties, parentValue, property: keyof InheritableProperties) => {
      const parentHasValue = parentValue != null;

      const inheritableValues = [undefined, '', null];
      const childIsInheriting = inheritableValues.some((value) => childRoute[property] === value);
      const inheritFromValue = childIsInheriting && parentHasValue;

      const inheritEmptyGroupByFromParent =
        property === 'group_by' &&
        parentHasValue &&
        isArray(childRoute[property]) &&
        childRoute[property]?.length === 0;

      const inheritFromParent = inheritFromValue || inheritEmptyGroupByFromParent;

      if (inheritFromParent) {
        // @ts-ignore
        inheritedProperties[property] = parentValue;
      }

      return inheritedProperties;
    },
    {}
  );

  return inherited;
}

export type RouteWithID = Route & { id: string };
export function addUniqueIdentifier(route: Route): RouteWithID {
  return {
    id: uniqueId('route-'),
    ...route,
    routes: route.routes?.map(addUniqueIdentifier) ?? [],
  };
}

export type TreeMatch = {
  /* we'll include the entire expanded policy tree for diagnostics */
  expandedTree: RouteWithID;
  /* the routes that matched the labels where the key is a route and the value is an array of instances that match that route */
  matchedPolicies: Map<RouteWithID, Array<RouteMatchResult<RouteWithID>>>;
};

export function matchAlertInstancesToPolicyTree(instances: Label[][], routingTree: Route): TreeMatch {
  // initially empty map of matches policies
  const matchedPolicies = new Map();

  // compute the entire expanded tree for matching routes and diagnostics
  // this will include inherited properties from parent nodes
  const expandedTree = addUniqueIdentifier(computeInheritedTree(routingTree));

  // let's first find all matching routes for the provided instances
  const matchesArray = instances.flatMap((labels) => findMatchingRoutes(expandedTree, labels));

  // now group the matches by route ID
  // this will give us a map of route IDs to their matching instances
  // we use the route ID as the key to ensure uniqueness
  const groupedByRoute = groupBy(matchesArray, (match) => match.route.id);
  Object.entries(groupedByRoute).forEach(([_key, match]) => {
    matchedPolicies.set(match[0].route, match);
  });

  return {
    expandedTree,
    matchedPolicies,
  };
}
