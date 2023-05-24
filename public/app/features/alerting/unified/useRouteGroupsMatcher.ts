import * as comlink from 'comlink';
import { useCallback, useEffect } from 'react';
import { useEnabled } from 'react-enable';

import { config, logError } from '@grafana/runtime';

import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';

import { logInfo } from './Analytics';
import { createWorker } from './createRouteGroupsMatcherWorker';
import { AlertingFeature } from './features';
import type { RouteGroupsMatcher } from './routeGroupsMatcher.worker';

// const matchingRoutesPreviewEnabled = Boolean(config.featureToggles.alertingNotificationsPoliciesMatchingInstances);

let routeMatcher: comlink.Remote<RouteGroupsMatcher> | undefined;

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
      console.error('CANNOT LOAD WORKER', e);
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

export function useRouteGroupsMatcher() {
  const workerPreviewEnabled = useEnabled(AlertingFeature.NotificationPoliciesV2MatchingInstances);
  console.log('workerPreviewEnabled', workerPreviewEnabled);

  useEffect(() => {
    if (workerPreviewEnabled) {
      const { disposeWorker } = loadWorker();
      return disposeWorker;
    }

    return () => null;
  }, [workerPreviewEnabled]);

  const getRouteGroupsMap = useCallback(
    async (rootRoute: RouteWithID, alertGroups: AlertmanagerGroup[]) => {
      if (!workerPreviewEnabled) {
        throw new Error('Matching routes preview is disabled');
      }

      if (!routeMatcher) {
        throw new Error('Route Matcher has not been initialized');
      }

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

  return { getRouteGroupsMap };
}
