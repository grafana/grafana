import * as comlink from 'comlink';
import { useCallback } from 'react';

import { config, logError } from '@grafana/runtime';

import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';

import { logInfo } from './Analytics';
import { createWorker } from './createRouteGroupsMatcherWorker';
import type { RouteGroupsMatcher } from './routeGroupsMatcher.worker';

const matchingRoutesPreviewEnabled = Boolean(config.featureToggles.alertingNotificationsPoliciesMatchingInstances);

let routeMatcher: comlink.Remote<RouteGroupsMatcher> | undefined;
if (matchingRoutesPreviewEnabled) {
  try {
    const worker = createWorker();
    routeMatcher = comlink.wrap<RouteGroupsMatcher>(worker);
  } catch (e: unknown) {
    if (e instanceof Error) {
      logError(e);
    }
    console.error('CANNOT LOAD WORKER', e);
  }
}

export function useRouteGroupsMatcher() {
  const getRouteGroupsMap = useCallback(async (rootRoute: RouteWithID, alertGroups: AlertmanagerGroup[]) => {
    if (!matchingRoutesPreviewEnabled) {
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
  }, []);

  return { getRouteGroupsMap };
}
