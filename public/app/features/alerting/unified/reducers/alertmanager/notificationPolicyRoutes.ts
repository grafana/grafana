import { createAction, createReducer } from '@reduxjs/toolkit';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../../types/amroutes';
import { addUniqueIdentifierToRoute } from '../../utils/amroutes';
import {
  InsertPosition,
  addRouteToReferenceRoute,
  cleanRouteIDs,
  mergePartialAmRouteWithRouteTree,
  omitRouteFromRouteTree,
} from '../../utils/routeTree';

export const updateRouteAction = createAction<{ update: Partial<FormAmRoute>; alertmanager: string }>('routes/update');
export const deleteRouteAction = createAction<{ id: string }>('routes/delete');
export const addRouteAction = createAction<{
  alertmanager: string;
  partialRoute: Partial<FormAmRoute>;
  referenceRouteIdentifier: string;
  insertPosition: InsertPosition;
}>('routes/add');

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
    // update an existing route
    .addCase(updateRouteAction, (draft, { payload }) => {
      const { update, alertmanager } = payload;
      const { alertmanager_config } = draft;

      if (!alertmanager_config.route) {
        return;
      }

      const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(alertmanager_config.route);
      const newRouteTree = mergePartialAmRouteWithRouteTree(alertmanager, update, rootRouteWithIdentifiers);
      alertmanager_config.route = cleanRouteIDs(newRouteTree);
    })
    // delete a route
    .addCase(deleteRouteAction, (draft, { payload }) => {
      const { id } = payload;
      const { alertmanager_config } = draft;

      // if we don't even have a root route, we bail
      if (!alertmanager_config.route) {
        return;
      }

      const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(alertmanager_config.route);
      const updatedPolicyTree = omitRouteFromRouteTree(id, rootRouteWithIdentifiers);
      draft.alertmanager_config.route = cleanRouteIDs(updatedPolicyTree);
    })
    // add a new route to given position
    .addCase(addRouteAction, (draft, { payload }) => {
      const { partialRoute, referenceRouteIdentifier, insertPosition, alertmanager } = payload;
      const { alertmanager_config } = draft;

      if (!alertmanager_config.route) {
        return;
      }

      const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(alertmanager_config.route);
      const updatedPolicyTree = addRouteToReferenceRoute(
        alertmanager,
        partialRoute,
        referenceRouteIdentifier,
        rootRouteWithIdentifiers,
        insertPosition
      );

      draft.alertmanager_config.route = cleanRouteIDs(updatedPolicyTree);
    });
});
