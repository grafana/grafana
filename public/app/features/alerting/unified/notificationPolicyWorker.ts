import * as comlink from 'comlink';

import type { AlertmanagerGroup, ObjectMatcher, RouteWithID } from '../../../plugins/datasource/alertmanager/types';

import { findMatchingAlertGroups, NormalizedRoute, normalizeRootRoute } from './utils/notification-policies';

const npFilterEngine = {
  getRouteGroupsMap(rootRoute: RouteWithID, groups: AlertmanagerGroup[]): Map<string, AlertmanagerGroup[]> {
    const normalizedRootRoute = normalizeRootRoute(rootRoute);

    function addRouteGroups(route: NormalizedRoute, acc: Map<string, AlertmanagerGroup[]>) {
      const routeGroups = findMatchingAlertGroups(normalizedRootRoute, route, groups);
      acc.set(route.id, routeGroups);

      route.routes?.forEach((r) => addRouteGroups(r, acc));
    }

    const routeGroupsMap = new Map<string, AlertmanagerGroup[]>();
    addRouteGroups(normalizedRootRoute, routeGroupsMap);

    return routeGroupsMap;
  },
};

export type FilterEngine = typeof npFilterEngine;

comlink.expose(npFilterEngine);

export interface RouteFilters {
  contactPointFilter?: string;
  labelMatchersFilter?: ObjectMatcher[];
}
