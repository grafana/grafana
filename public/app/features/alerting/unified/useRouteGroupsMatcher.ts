import * as comlink from 'comlink';
import { useCallback, useEffect, useRef } from 'react';

import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';

import { logInfo } from './Analytics';
import type { RouteGroupsMatcher } from './routeGroupsMatcher.worker';

export function useRouteGroupsMatcher() {
  const workerRef = useRef(new Worker(new URL('./routeGroupsMatcher.worker.ts', import.meta.url), { type: 'module' }));
  const routeMatcherRef = useRef(comlink.wrap<RouteGroupsMatcher>(workerRef.current));

  useEffect(() => {
    const worker = workerRef.current;
    const routeMatcher = routeMatcherRef.current;

    return () => {
      routeMatcher[comlink.releaseProxy]();
      worker.terminate();
    };
  }, []);

  const getRouteGroupsMap = useCallback(async (rootRoute: RouteWithID, alertGroups: AlertmanagerGroup[]) => {
    const startTime = performance.now();
    const result = await routeMatcherRef.current.getRouteGroupsMap(rootRoute, alertGroups);
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
