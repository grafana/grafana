import * as comlink from 'comlink';
import { useCallback, useEffect } from 'react';

import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../types/unified-alerting-dto';

import { logError, logInfo } from './Analytics';
import { createWorker } from './createRouteGroupsMatcherWorker';
import type { MatchOptions, RouteGroupsMatcher } from './routeGroupsMatcher';

let routeMatcher: comlink.Remote<RouteGroupsMatcher> | undefined;

// Load worker loads the worker if it's not loaded yet
// and returns a function to dispose of the worker
// We do it to enable feature toggling. If the feature is disabled we don't wont to load the worker code at all
// An alternative way would be to move all this code to the hook below, but it will create and terminate the worker much more often
function loadWorker() {
  let worker: Worker | undefined;

  if (routeMatcher === undefined) {
    try {
      worker = createWorker();
      routeMatcher = comlink.wrap<RouteGroupsMatcher>(worker);
    } catch (e: unknown) {
      if (e instanceof Error) {
        logError(e);
      }
    }
  }

  const disposeWorker = () => {
    if (worker && routeMatcher) {
      routeMatcher[comlink.releaseProxy]();
      worker.terminate();

      routeMatcher = undefined;
      worker = undefined;
    }
  };

  return { disposeWorker };
}

function validateWorker(matcher: typeof routeMatcher): asserts matcher is comlink.Remote<RouteGroupsMatcher> {
  if (!routeMatcher) {
    throw new Error('Route Matcher has not been initialized');
  }
}

export function useRouteGroupsMatcher() {
  useEffect(() => {
    const { disposeWorker } = loadWorker();
    return disposeWorker;
  }, []);

  const getRouteGroupsMap = useCallback(
    async (rootRoute: RouteWithID, alertGroups: AlertmanagerGroup[], options?: MatchOptions) => {
      validateWorker(routeMatcher);

      const startTime = performance.now();

      const result = await routeMatcher.getRouteGroupsMap(rootRoute, alertGroups, options);

      const timeSpent = performance.now() - startTime;

      logInfo(`Route Groups Matched in  ${timeSpent} ms`, {
        matchingTime: timeSpent.toString(),
        alertGroupsCount: alertGroups.length.toString(),
        // Counting all nested routes might be too time-consuming, so we only count the first level
        topLevelRoutesCount: rootRoute.routes?.length.toString() ?? '0',
      });

      return result;
    },
    []
  );

  const matchInstancesToRoutes = useCallback(
    async (rootRoute: RouteWithID, instances: Labels[], options?: MatchOptions) => {
      validateWorker(routeMatcher);

      const startTime = performance.now();

      const result = await routeMatcher.matchInstancesToRoutes(rootRoute, instances, options);

      const timeSpent = performance.now() - startTime;

      logInfo(`Instances Matched in  ${timeSpent} ms`, {
        matchingTime: timeSpent.toString(),
        instancesToMatchCount: instances.length.toString(),
        // Counting all nested routes might be too time-consuming, so we only count the first level
        topLevelRoutesCount: rootRoute.routes?.length.toString() ?? '0',
      });

      return result;
    },
    []
  );

  return { getRouteGroupsMap, matchInstancesToRoutes };
}
