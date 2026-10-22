import { type Middleware, type Reducer, configureStore } from '@reduxjs/toolkit';

import { generatedAPI as historianAPIv0alpha1 } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { generatedAPI as notificationsAPIv1beta1 } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { generatedAPI as rulesAPIv0alpha1 } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

/**
 * The reducers of every API client this package's hooks and components use. Add them, together with
 * `alertingAPIMiddleware`, to a Redux store you already have.
 */
export const alertingAPIReducers = {
  [notificationsAPIv1beta1.reducerPath]: notificationsAPIv1beta1.reducer,
  [rulesAPIv0alpha1.reducerPath]: rulesAPIv0alpha1.reducer,
  [historianAPIv0alpha1.reducerPath]: historianAPIv0alpha1.reducer,
};

/** The middleware that goes with `alertingAPIReducers`. */
export const alertingAPIMiddleware = [
  notificationsAPIv1beta1.middleware,
  rulesAPIv0alpha1.middleware,
  historianAPIv0alpha1.middleware,
] as const;

// The parts of an RTKQ client a store needs.
interface StoreAPI {
  reducerPath: string;
  reducer: Reducer;
  middleware: Middleware;
}

/**
 * A Redux store with only this package's API clients in it, for apps that have no store of their own, or
 * whose store runs on an older Redux Toolkit than this package. Wrap the package's hooks and components in a
 * react-redux `Provider` with it.
 *
 * Pass any other clients from this package the app uses, e.g. `createAlertingStore([convertAPI])`, so they
 * share the one store.
 */
export function createAlertingStore(extraAPIs: StoreAPI[] = []) {
  const extraReducers = Object.fromEntries(extraAPIs.map((api) => [api.reducerPath, api.reducer]));

  return configureStore({
    reducer: { ...alertingAPIReducers, ...extraReducers },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .concat(alertingAPIMiddleware)
        .concat(extraAPIs.map((api) => api.middleware)),
  });
}
