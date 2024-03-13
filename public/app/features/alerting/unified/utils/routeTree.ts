/**
 * Various helper functions to modify (immutably) the route tree, aka "notification policies"
 */

import { produce } from 'immer';
import { omit } from 'lodash';

import { insertAfterImmutably, insertBeforeImmutably } from '@grafana/data/src/utils/arrayUtils';
import { Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../types/amroutes';

import { formAmRouteToAmRoute } from './amroutes';

// add a form submission to the route tree
export const mergePartialAmRouteWithRouteTree = (
  alertManagerSourceName: string,
  partialFormRoute: Partial<FormAmRoute>,
  routeTree: RouteWithID
): Route => {
  const existing = findExistingRoute(partialFormRoute.id ?? '', routeTree);
  if (!existing) {
    throw new Error(`No such route with ID '${partialFormRoute.id}'`);
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
export const omitRouteFromRouteTree = (findRoute: RouteWithID, routeTree: RouteWithID): RouteWithID => {
  if (findRoute.id === routeTree.id) {
    throw new Error('You cant remove the root policy');
  }

  function findAndOmit(currentRoute: RouteWithID): RouteWithID {
    return {
      ...currentRoute,
      routes: currentRoute.routes?.reduce((acc: RouteWithID[] = [], route) => {
        if (route.id === findRoute.id) {
          return acc;
        }

        acc.push(route);
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
  referenceRoute: RouteWithID,
  routeTree: RouteWithID,
  position: InsertPosition
): RouteWithID => {
  const newRoute = formAmRouteToAmRoute(alertManagerSourceName, partialFormRoute, routeTree);

  return produce(routeTree, (draftTree) => {
    const [routeInTree, parentRoute, positionInParent] = findRouteInTree(draftTree, referenceRoute);

    if (routeInTree === undefined || parentRoute === undefined || positionInParent === undefined) {
      throw new Error(`could not find reference route "${referenceRoute.id}" in tree`);
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
      parentRoute.routes = insertBeforeImmutably(parentRoute.routes ?? [], newRoute, positionInParent);
    }

    // insert new policy after / below the referenceRoute
    if (position === 'below') {
      parentRoute.routes = insertAfterImmutably(parentRoute.routes ?? [], newRoute, positionInParent);
    }
  });
};

type RouteMatch = Route | undefined;

export function findRouteInTree(
  routeTree: RouteWithID,
  referenceRoute: RouteWithID
): [matchingRoute: RouteMatch, parentRoute: RouteMatch, positionInParent: number | undefined] {
  let matchingRoute: RouteMatch;
  let matchingRouteParent: RouteMatch;
  let matchingRoutePositionInParent: number | undefined;

  // recurse through the tree to find the matching route, its parent and the position of the route in the parent
  function findRouteInTree(currentRoute: RouteWithID, index: number, parentRoute: RouteWithID) {
    if (matchingRoute) {
      return;
    }

    if (currentRoute.id === referenceRoute.id) {
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

export function cleanRouteIDs(route: Route | RouteWithID): Route {
  return omit(
    {
      ...route,
      routes: route.routes?.map((route) => cleanRouteIDs(route)),
    },
    'id'
  );
}

export function findExistingRoute(id: string, routeTree: RouteWithID): RouteWithID | undefined {
  return routeTree.id === id ? routeTree : routeTree.routes?.find((route) => findExistingRoute(id, route));
}
