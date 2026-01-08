/**
 * Various helper functions to modify (immutably) the route tree, aka "notification policies"
 */

import { produce } from 'immer';
import { omit } from 'lodash';

import { arrayUtils } from '@grafana/data';
import { ROUTES_META_SYMBOL, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree,
} from '../openapi/routesApi.gen';
import { FormAmRoute } from '../types/amroutes';

import { formAmRouteToAmRoute } from './amroutes';
import { ERROR_NEWER_CONFIGURATION } from './k8s/errors';

// add a form submission to the route tree
export const mergePartialAmRouteWithRouteTree = (
  alertManagerSourceName: string,
  partialFormRoute: Partial<FormAmRoute>,
  routeTree: RouteWithID
): Route => {
  const existing = findExistingRoute(partialFormRoute.id ?? '', routeTree);
  if (!existing) {
    throw new Error(`No such route with ID '${partialFormRoute.id}'`, {
      // this allows any error handling (when using stringifyErrorLike) to identify and translate this exception
      // we do, however, make the assumption that this exception is the result of the policy tree having been updating by the user
      // and this not being a programmer error.
      cause: ERROR_NEWER_CONFIGURATION,
    });
  }

  function findAndReplace(currentRoute: RouteWithID): Route {
    let updatedRoute: Route = currentRoute;

    if (currentRoute.id === partialFormRoute.id) {
      const newRoute = formAmRouteToAmRoute(alertManagerSourceName, partialFormRoute, routeTree);
      updatedRoute = {
        ...currentRoute,
        ...newRoute,
      };
    }

    return {
      ...updatedRoute,
      routes: currentRoute.routes?.map(findAndReplace),
    };
  }

  return findAndReplace(routeTree);
};

// remove a route from the policy tree, returns a new tree
// make sure to omit the "id" because Prometheus / Loki / Mimir will reject the payload
export const omitRouteFromRouteTree = (id: string, routeTree: RouteWithID): RouteWithID => {
  if (id === routeTree.id) {
    throw new Error('You cant remove the root policy');
  }

  function findAndOmit(currentRoute: RouteWithID): RouteWithID {
    return {
      ...currentRoute,
      routes: currentRoute.routes?.reduce((acc: RouteWithID[] = [], route) => {
        if (route.id === id) {
          return acc;
        }

        acc.push(findAndOmit(route));
        return acc;
      }, []),
    };
  }

  return findAndOmit(routeTree);
};

export type InsertPosition = 'above' | 'below' | 'child';

// add a new route to a parent route
export const addRouteToReferenceRoute = (
  alertManagerSourceName: string,
  partialFormRoute: Partial<FormAmRoute>,
  referenceRouteIdentifier: string,
  routeTree: RouteWithID,
  position: InsertPosition
): RouteWithID => {
  const newRoute = formAmRouteToAmRoute(alertManagerSourceName, partialFormRoute, routeTree);

  return produce(routeTree, (draftTree) => {
    const [routeInTree, parentRoute, positionInParent] = findRouteInTree(draftTree, referenceRouteIdentifier);

    if (routeInTree === undefined || parentRoute === undefined || positionInParent === undefined) {
      throw new Error(`could not find reference route "${referenceRouteIdentifier}" in tree`, {
        cause: ERROR_NEWER_CONFIGURATION,
      });
    }

    // if user wants to insert new child policy, append to the bottom of children
    if (position === 'child') {
      if (routeInTree.routes) {
        routeInTree.routes.push(newRoute);
      } else {
        routeInTree.routes = [newRoute];
      }
    }

    // insert new policy before / above the referenceRoute
    if (position === 'above') {
      parentRoute.routes = arrayUtils.insertBeforeImmutably(parentRoute.routes ?? [], newRoute, positionInParent);
    }

    // insert new policy after / below the referenceRoute
    if (position === 'below') {
      parentRoute.routes = arrayUtils.insertAfterImmutably(parentRoute.routes ?? [], newRoute, positionInParent);
    }
  });
};

type RouteMatch = Route | undefined;

export function findRouteInTree(
  routeTree: RouteWithID,
  referenceRouteIdentifier: string
): [matchingRoute: RouteMatch, parentRoute: RouteMatch, positionInParent: number | undefined] {
  let matchingRoute: RouteMatch;
  let matchingRouteParent: RouteMatch;
  let matchingRoutePositionInParent: number | undefined;

  // recurse through the tree to find the matching route, its parent and the position of the route in the parent
  function findRouteInTree(currentRoute: RouteWithID, index: number, parentRoute: RouteWithID) {
    if (matchingRoute) {
      return;
    }

    if (currentRoute.id === referenceRouteIdentifier) {
      matchingRoute = currentRoute;
      matchingRouteParent = parentRoute;
      matchingRoutePositionInParent = index;
    }

    if (currentRoute.routes) {
      currentRoute.routes.forEach((route, index) => findRouteInTree(route, index, currentRoute));
    }
  }

  findRouteInTree(routeTree, 0, routeTree);

  return [matchingRoute, matchingRouteParent, matchingRoutePositionInParent];
}

export function cleanRouteIDs<
  T extends RouteWithID | Route | ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route,
>(route: T): Omit<T, 'id'> {
  return omit(
    {
      ...route,
      routes: route.routes?.map((route) => cleanRouteIDs(route)),
    },
    'id'
  );
}

// remove IDs from the Kubernetes routes
export function cleanKubernetesRouteIDs(
  routingTree: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree
): ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RoutingTree {
  return produce(routingTree, (draft) => {
    draft.spec.routes = draft.spec.routes.map(cleanRouteIDs);
  });
}

export function findExistingRoute(id: string, routeTree: RouteWithID): RouteWithID | undefined {
  return routeTree.id === id ? routeTree : routeTree.routes?.find((route) => findExistingRoute(id, route));
}

/**
 * This function converts an object into a unique hash by sorting the keys and applying a simple integer hash
 */
export function hashRoute(route: Route): string {
  const jsonString = JSON.stringify(stabilizeRoute(route));

  // Simple hash function - convert to a number-based hash
  let hash = 0;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(36);
}

/**
 * This function will sort the route's values and set the keys in a deterministic order
 */
export function stabilizeRoute(route: Route): Required<Route> {
  const result: Required<Route> = {
    receiver: route.receiver ?? '',
    group_by: route.group_by ? [...route.group_by].sort() : [],
    continue: route.continue ?? false,
    object_matchers: route.object_matchers ? [...route.object_matchers].sort() : [],
    matchers: route.matchers ? [...route.matchers].sort() : [],
    match: route.match ? sortRecord(route.match) : {},
    match_re: route.match_re ? sortRecord(route.match_re) : {},
    group_wait: route.group_wait ?? '',
    group_interval: route.group_interval ?? '',
    repeat_interval: route.repeat_interval ?? '',
    routes: route.routes ?? [], // routes are not sorted as if the order of the routes has changed, the hash should be different
    mute_time_intervals: route.mute_time_intervals ? [...route.mute_time_intervals].sort() : [],
    active_time_intervals: route.active_time_intervals ? [...route.active_time_intervals].sort() : [],
    provenance: route.provenance ?? '',
    [ROUTES_META_SYMBOL]: {},
  };

  return result;
}

// function to sort the keys of a record
function sortRecord(record: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};

  Object.keys(record)
    .sort()
    .forEach((key) => {
      sorted[key] = record[key];
    });

  return sorted;
}
