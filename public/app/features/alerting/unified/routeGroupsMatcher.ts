import { MatchResult, matchAlertInstancesToPolicyTree } from '@grafana/alerting/unstable';

import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../types/unified-alerting-dto';

import { findMatchingAlertGroups, normalizeRoute, unquoteRouteMatchers } from './utils/notification-policies';

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

  matchInstancesToRoutes(routeTree: RouteWithID, instances: Labels[], options?: MatchOptions): MatchResult {
    const normalizedRootRoute = getNormalizedRoute(routeTree, options);

    const normalizedLabels = instances.map((labels) => Object.entries(labels));
    const treeMatchResults = matchAlertInstancesToPolicyTree(normalizedLabels, normalizedRootRoute);

    return [
      {
        treeMetadata: {
          name: 'user-defined',
        },
        ...treeMatchResults,
      },
    ];
  },
};

function getNormalizedRoute(route: RouteWithID, options?: MatchOptions): RouteWithID {
  return options?.unquoteMatchers ? unquoteRouteMatchers(normalizeRoute(route)) : normalizeRoute(route);
}

export type RouteGroupsMatcher = typeof routeGroupsMatcher;
