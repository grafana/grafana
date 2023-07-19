import * as comlink from 'comlink';
import { useCallback, useEffect } from 'react';
import { useEnabled } from 'react-enable';

import { logError } from '@grafana/runtime';

import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../types/unified-alerting-dto';

import { logInfo } from './Analytics';
import { createWorker } from './createRouteGroupsMatcherWorker';
import { AlertingFeature } from './features';
import type { RouteGroupsMatcher } from './routeGroupsMatcher';

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

function validateWorker(
  toggleEnabled: boolean,
  matcher: typeof routeMatcher
): asserts matcher is comlink.Remote<RouteGroupsMatcher> {
  if (!toggleEnabled) {
    throw new Error('Matching routes preview is disabled');
  }

  if (!routeMatcher) {
    throw new Error('Route Matcher has not been initialized');
  }
}

export function useRouteGroupsMatcher() {
  const workerPreviewEnabled = useEnabled(AlertingFeature.NotificationPoliciesV2MatchingInstances);

  useEffect(() => {
    if (workerPreviewEnabled) {
      const { disposeWorker } = loadWorker();
      return disposeWorker;
    }

    return () => null;
  }, [workerPreviewEnabled]);

  const getRouteGroupsMap = useCallback(
    async (rootRoute: RouteWithID, alertGroups: AlertmanagerGroup[]) => {
      validateWorker(workerPreviewEnabled, routeMatcher);

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
    },
    [workerPreviewEnabled]
  );

  const matchInstancesToRoute = useCallback(
    async (rootRoute: RouteWithID, instancesToMatch: Labels[]) => {
      validateWorker(workerPreviewEnabled, routeMatcher);

      const startTime = performance.now();

      const result = await routeMatcher.matchInstancesToRoute(rootRoute, instancesToMatch);

      const timeSpent = performance.now() - startTime;

      logInfo(`Instances Matched in  ${timeSpent} ms`, {
        matchingTime: timeSpent.toString(),
        instancesToMatchCount: instancesToMatch.length.toString(),
        // Counting all nested routes might be too time-consuming, so we only count the first level
        topLevelRoutesCount: rootRoute.routes?.length.toString() ?? '0',
      });

      return result;
    },
    [workerPreviewEnabled]
  );

  return { getRouteGroupsMap, matchInstancesToRoute };
}
