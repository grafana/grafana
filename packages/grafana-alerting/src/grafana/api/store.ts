import { configureStore } from '@reduxjs/toolkit';

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

/**
 * A Redux store with only this package's API clients in it, for apps that have no store of their own, or
 * whose store runs on an older Redux Toolkit than this package. Wrap the package's hooks and components in a
 * react-redux `Provider` with it.
 */
export function createAlertingStore() {
  return configureStore({
    reducer: alertingAPIReducers,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(alertingAPIMiddleware),
  });
}
