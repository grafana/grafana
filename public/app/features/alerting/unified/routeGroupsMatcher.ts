import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../types/unified-alerting-dto';

import {
  AlertInstanceMatch,
  findMatchingAlertGroups,
  findMatchingRoutes,
  normalizeRoute,
  unquoteRouteMatchers,
} from './utils/notification-policies';

export interface MatchOptions {
  unquoteMatchers?: boolean;
}

export const routeGroupsMatcher = {
  getRouteGroupsMap(
    rootRoute: RouteWithID,
    groups: AlertmanagerGroup[],
    options?: MatchOptions
  ): Map<string, AlertmanagerGroup[]> {
    const normalizedRootRoute = getNormalizedRoute(rootRoute, options);

    function addRouteGroups(route: RouteWithID, acc: Map<string, AlertmanagerGroup[]>) {
      const routeGroups = findMatchingAlertGroups(normalizedRootRoute, route, groups);
      acc.set(route.id, routeGroups);

      route.routes?.forEach((r) => addRouteGroups(r, acc));
    }

    const routeGroupsMap = new Map<string, AlertmanagerGroup[]>();
    addRouteGroups(normalizedRootRoute, routeGroupsMap);

    return routeGroupsMap;
  },

  matchInstancesToRoute(
    routeTree: RouteWithID,
    instancesToMatch: Labels[],
    options?: MatchOptions
  ): Map<string, AlertInstanceMatch[]> {
    const result = new Map<string, AlertInstanceMatch[]>();

    const normalizedRootRoute = getNormalizedRoute(routeTree, options);

    instancesToMatch.forEach((instance) => {
      const matchingRoutes = findMatchingRoutes(normalizedRootRoute, Object.entries(instance));
      matchingRoutes.forEach(({ route, labelsMatch }) => {
        const currentRoute = result.get(route.id);

        if (currentRoute) {
          currentRoute.push({ instance, labelsMatch });
        } else {
          result.set(route.id, [{ instance, labelsMatch }]);
        }
      });
    });

    return result;
  },
};

function getNormalizedRoute(route: RouteWithID, options?: MatchOptions): RouteWithID {
  return options?.unquoteMatchers ? unquoteRouteMatchers(normalizeRoute(route)) : normalizeRoute(route);
}

export type RouteGroupsMatcher = typeof routeGroupsMatcher;
