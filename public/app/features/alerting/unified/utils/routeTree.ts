/**
 * Various helper functions to modify (immutably) the route tree, aka "notification policies"
 */

import { omit } from 'lodash';

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
      updatedRoute = omit(
        {
          ...currentRoute,
          ...newRoute,
        },
        'id'
      );
    }

    return omit(
      {
        ...updatedRoute,
        routes: currentRoute.routes?.map(findAndReplace),
      },
      'id'
    );
  }

  return findAndReplace(routeTree);
};

// remove a route from the policy tree, returns a new tree
// make sure to omit the "id" because Prometheus / Loki / Mimir will reject the payload
export const omitRouteFromRouteTree = (findRoute: RouteWithID, routeTree: RouteWithID): Route => {
  if (findRoute.id === routeTree.id) {
    throw new Error('You cant remove the root policy');
  }

  function findAndOmit(currentRoute: RouteWithID): Route {
    return omit(
      {
        ...currentRoute,
        routes: currentRoute.routes?.reduce((acc: Route[] = [], route) => {
          if (route.id === findRoute.id) {
            return acc;
          }

          acc.push(findAndOmit(route));
          return acc;
        }, []),
      },
      'id'
    );
  }

  return findAndOmit(routeTree);
};

// add a new route to a parent route
export const addRouteToParentRoute = (
  alertManagerSourceName: string,
  partialFormRoute: Partial<FormAmRoute>,
  parentRoute: RouteWithID,
  routeTree: RouteWithID
): Route => {
  const newRoute = formAmRouteToAmRoute(alertManagerSourceName, partialFormRoute, routeTree);

  function findAndAdd(currentRoute: RouteWithID): RouteWithID {
    if (currentRoute.id === parentRoute.id) {
      return {
        ...currentRoute,
        // TODO fix this typescript exception, it's... complicated
        // @ts-ignore
        routes: currentRoute.routes?.concat(newRoute),
      };
    }

    return {
      ...currentRoute,
      routes: currentRoute.routes?.map(findAndAdd),
    };
  }

  function findAndOmitId(currentRoute: RouteWithID): Route {
    return omit(
      {
        ...currentRoute,
        routes: currentRoute.routes?.map(findAndOmitId),
      },
      'id'
    );
  }

  return findAndOmitId(findAndAdd(routeTree));
};

export function findExistingRoute(id: string, routeTree: RouteWithID): RouteWithID | undefined {
  return routeTree.id === id ? routeTree : routeTree.routes?.find((route) => findExistingRoute(id, route));
}
