import * as comlink from 'comlink';
import { useCallback } from 'react';

import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';

import { logInfo } from './Analytics';
import type { RouteGroupsMatcher } from './routeGroupsMatcher.worker';

const worker = new Worker(new URL('./routeGroupsMatcher.worker.ts', import.meta.url), { type: 'module' });
const routeMatcher = comlink.wrap<RouteGroupsMatcher>(worker);

export function useRouteGroupsMatcher() {
  const getRouteGroupsMap = useCallback(async (rootRoute: RouteWithID, alertGroups: AlertmanagerGroup[]) => {
    const startTime = performance.now();

    const result = await routeMatcher.getRouteGroupsMap(rootRoute, alertGroups);

    const timeSpent = performance.now() - startTime;

    logInfo(`Route Groups Matched in  ${timeSpent} ms`, {
      matchingTime: timeSpent.toString(),
      alertGroupsCount: alertGroups.length.toString(),
      // Counting all nested routes might be too time-consuming, so we only count the first level
      topLevelRoutesCount: rootRoute.routes?.length.toString() ?? '0',
    });

    return result;
  }, []);

  return { getRouteGroupsMap };
}
