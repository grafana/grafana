import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { configureStore } from '@reduxjs/toolkit';
import { createMemoryHistory } from 'history';
import { type PropsWithChildren } from 'react';
import { Provider } from 'react-redux';

import { type AlertManagerDataSourceJsonData, AlertManagerImplementation } from '@grafana/alerting/internal';
import { HistoryWrapper, LocationServiceProvider, setLocationService } from '@grafana/runtime';
import { getTestFeatureFlagClient } from '@grafana/test-utils/feature-flags';
import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { iamAPIv0alpha1 } from 'app/api/clients/iam/v0alpha1';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertmanagerProvider } from '../../../state/AlertmanagerContext';
import { setupDataSources } from '../../../testSetup/datasources';
import { mockDataSource } from '../../../testSetup/mockDataSource';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

export function createAlertmanagerWrapper(alertmanagerSourceName: string) {
  // Silence abilities use the folder facade, whose skipped queries still need all three API clients.
  const store = configureStore({
    reducer: {
      [browseDashboardsAPI.reducerPath]: browseDashboardsAPI.reducer,
      [folderAPIv1beta1.reducerPath]: folderAPIv1beta1.reducer,
      [iamAPIv0alpha1.reducerPath]: iamAPIv0alpha1.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }).concat(
        browseDashboardsAPI.middleware,
        folderAPIv1beta1.middleware,
        iamAPIv0alpha1.middleware
      ),
  });
  // Keep URL state isolated between wrappers, as the app wrapper did.
  const locationService = new HistoryWrapper(createMemoryHistory());
  setLocationService(locationService);

  function AlertmanagerWrapper(props: PropsWithChildren) {
    return (
      <Provider store={store}>
        <OpenFeatureProvider client={getTestFeatureFlagClient()}>
          <LocationServiceProvider service={locationService}>
            <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertmanagerSourceName}>
              {props.children}
            </AlertmanagerProvider>
          </LocationServiceProvider>
        </OpenFeatureProvider>
      </Provider>
    );
  }
  return AlertmanagerWrapper;
}

/**
 * Alertmanager source name that does not match any datasource. Use with
 * `createAlertmanagerWrapper` and no notification permissions to leave
 * `selectedAlertmanager` undefined in AlertmanagerContext.
 */
export const UNRESOLVED_ALERTMANAGER_SOURCE = 'does-not-exist';

/**
 * The minimum permission that makes the Grafana built-in alertmanager appear in the
 * available alertmanagers list (`getAlertManagerDataSourcesByPermission` checks
 * `builtinAlertmanagerPermissions`, which includes `AlertingNotificationsRead`).
 *
 * Tests that rely on `selectedAlertmanager` resolving to the Grafana AM **must** include
 * this permission in their `grantUserPermissions` call, because each call to
 * `grantUserPermissions` replaces the entire spy — there is no additive stacking.
 *
 * @example
 * grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceCreate]);
 */
export const GRAFANA_AM_VISIBILITY_PERMISSION = AccessControlAction.AlertingNotificationsRead;

/**
 * The minimum permission that makes an external (Mimir/Cortex) alertmanager appear in
 * the available alertmanagers list (`getAlertManagerDataSourcesByPermission` checks
 * `permissions['notification'].external`, which is `AlertingNotificationsExternalRead`).
 *
 * Tests that rely on `selectedAlertmanager` resolving to an external AM **must** include
 * this permission in their `grantUserPermissions` call.
 *
 * @example
 * grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalWrite]);
 */
export const EXTERNAL_AM_VISIBILITY_PERMISSION = AccessControlAction.AlertingNotificationsExternalRead;

export function setupGrafanaAlertmanager() {
  setupDataSources(
    mockDataSource<AlertManagerDataSourceJsonData>({
      name: GRAFANA_RULES_SOURCE_NAME,
      type: DataSourceType.Alertmanager,
    })
  );
  return GRAFANA_RULES_SOURCE_NAME;
}

export function setupVanillaPrometheusAlertmanager() {
  const name = 'vanilla-prometheus-alertmanager';

  setupDataSources(
    mockDataSource<AlertManagerDataSourceJsonData>({
      uid: name,
      name,
      type: DataSourceType.Alertmanager,
      jsonData: { implementation: AlertManagerImplementation.prometheus },
    })
  );

  return name;
}

const MIMIR_ALERTMANAGER_UID = 'mimir-alertmanager';

export function setupMimirAlertmanager({
  uid = MIMIR_ALERTMANAGER_UID,
  name = MIMIR_ALERTMANAGER_UID,
}: { uid?: string; name?: string } = {}) {
  setupDataSources(
    mockDataSource<AlertManagerDataSourceJsonData>({
      uid,
      name,
      type: DataSourceType.Alertmanager,
      jsonData: { implementation: AlertManagerImplementation.mimir },
    })
  );

  return name;
}
