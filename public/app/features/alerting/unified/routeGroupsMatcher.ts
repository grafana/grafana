import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../types/unified-alerting-dto';

import {
  AlertInstanceMatch,
  findMatchingAlertGroups,
  findMatchingRoutes,
  normalizeRoute,
} from './utils/notification-policies';

export const routeGroupsMatcher = {
  getRouteGroupsMap(rootRoute: RouteWithID, groups: AlertmanagerGroup[]): Map<string, AlertmanagerGroup[]> {
    const normalizedRootRoute = normalizeRoute(rootRoute);

    function addRouteGroups(route: RouteWithID, acc: Map<string, AlertmanagerGroup[]>) {
      const routeGroups = findMatchingAlertGroups(normalizedRootRoute, route, groups);
      acc.set(route.id, routeGroups);

      route.routes?.forEach((r) => addRouteGroups(r, acc));
    }

    const routeGroupsMap = new Map<string, AlertmanagerGroup[]>();
    addRouteGroups(normalizedRootRoute, routeGroupsMap);

    return routeGroupsMap;
  },

  matchInstancesToRoute(routeTree: RouteWithID, instancesToMatch: Labels[]): Map<string, AlertInstanceMatch[]> {
    const result = new Map<string, AlertInstanceMatch[]>();

    const normalizedRootRoute = normalizeRoute(routeTree);

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

export type RouteGroupsMatcher = typeof routeGroupsMatcher;
