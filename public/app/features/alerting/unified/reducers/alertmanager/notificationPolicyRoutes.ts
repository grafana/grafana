import { createAction, createReducer } from '@reduxjs/toolkit';

import { AlertManagerCortexConfig, Route } from 'app/plugins/datasource/alertmanager/types';

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
      const { newRoute } = payload;
      const { _metadata: newMetadata, ...newRouteStripped } = newRoute;

      draft.alertmanager_config.route = newRouteStripped;
    });
});
