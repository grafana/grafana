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

  matchInstancesToRoute(
    routeTree: RouteWithID,
    instancesToMatch: Labels[]
  ): { result: Map<string, AlertInstanceMatch[]>; resultPath: Map<string, AlertInstanceMatch[]> } {
    const result = new Map<string, AlertInstanceMatch[]>();
    const resultPath = new Map<string, AlertInstanceMatch[]>();

    const normalizedRootRoute = normalizeRoute(routeTree);

    // find matching routes for each instance and add them to the results map and the path map
    instancesToMatch.forEach((instance) => {
      const { matchesResult: matchingRoutes, matchesPath } = findMatchingRoutes(
        normalizedRootRoute,
        Object.entries(instance)
      );
      // Only to convert Label[] to Labels[] - needs better approach
      matchingRoutes.forEach(({ route, details, labelsMatch }) => {
        const matchDetails = new Map(
          Array.from(details.entries()).map(([matcher, labels]) => [matcher, Object.fromEntries(labels)])
        );

        const currentRoute = result.get(route.id);
        if (currentRoute) {
          currentRoute.push({ instance, matchDetails, labelsMatch });
        } else {
          result.set(route.id, [{ instance, matchDetails, labelsMatch }]);
        }
      });
      matchesPath.forEach(({ route: routeInPath, details, labelsMatch }) => {
        const matchDetailsPath = new Map(
          Array.from(details.entries()).map(([matcher, labels]) => [matcher, Object.fromEntries(labels)])
        );

        const currentRouteInpath = resultPath.get(routeInPath.id);
        if (currentRouteInpath) {
          currentRouteInpath.push({ instance, matchDetails: matchDetailsPath, labelsMatch });
        } else {
          resultPath.set(routeInPath.id, [{ instance, matchDetails: matchDetailsPath, labelsMatch }]);
        }
      });
    });

    return { result: result, resultPath: resultPath };
  },
};

export type RouteGroupsMatcher = typeof routeGroupsMatcher;
