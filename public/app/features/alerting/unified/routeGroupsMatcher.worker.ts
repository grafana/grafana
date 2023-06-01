import * as comlink from 'comlink';

import type { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';

import { findMatchingAlertGroups, normalizeRoute } from './utils/notification-policies';

const routeGroupsMatcher = {
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
};

export type RouteGroupsMatcher = typeof routeGroupsMatcher;

comlink.expose(routeGroupsMatcher);
