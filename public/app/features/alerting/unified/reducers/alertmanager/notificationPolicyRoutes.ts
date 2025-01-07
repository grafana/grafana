import { createAction, createReducer } from '@reduxjs/toolkit';

import { AlertManagerCortexConfig, Route } from 'app/plugins/datasource/alertmanager/types';

import { ERROR_NEWER_CONFIGURATION } from '../../utils/k8s/errors';

export const updateRouteAction = createAction<{
  newRoute: Route;
  oldRoute: Route;
}>('routes/update');

const initialState: AlertManagerCortexConfig = {
  alertmanager_config: {},
  template_files: {},
};

/**
 * This reducer will manage action related to routes and make sure all operations on the alertmanager
 * configuration happen immutably and only mutate what they need.
 */
export const routesReducer = createReducer(initialState, (builder) => {
  builder
    // update routes tree
    .addCase(updateRouteAction, (draft, { payload }) => {
      const { newRoute, oldRoute } = payload;
      const { _metadata, ...oldRouteStripped } = oldRoute;
      const { _metadata: newMetadata, ...newRouteStripped } = newRoute;

      const latestRouteFromConfig = draft.alertmanager_config.route;

      const configChangedInMeantime = JSON.stringify(oldRouteStripped) !== JSON.stringify(latestRouteFromConfig);

      if (configChangedInMeantime) {
        throw new Error('configuration modification conflict', { cause: ERROR_NEWER_CONFIGURATION });
      }

      draft.alertmanager_config.route = newRouteStripped;
    });
});
