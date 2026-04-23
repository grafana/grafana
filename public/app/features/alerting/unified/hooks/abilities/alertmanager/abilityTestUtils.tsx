import { type PropsWithChildren } from 'react';
import { getWrapper } from 'test/test-utils';

import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { mockDataSource } from '../../../mocks';
import { AlertmanagerProvider } from '../../../state/AlertmanagerContext';
import { setupDataSources } from '../../../testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

export function createAlertmanagerWrapper(alertmanagerSourceName: string) {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  function AlertmanagerWrapper(props: PropsWithChildren) {
    return (
      <ProviderWrapper>
        <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertmanagerSourceName}>
          {props.children}
        </AlertmanagerProvider>
      </ProviderWrapper>
    );
  }
  return AlertmanagerWrapper;
}

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
  setupDataSources(
    mockDataSource<AlertManagerDataSourceJsonData>({
      name: GRAFANA_RULES_SOURCE_NAME,
      type: DataSourceType.Alertmanager,
      jsonData: { implementation: AlertManagerImplementation.prometheus },
    })
  );
  return 'does-not-exist';
}

export function setupMimirAlertmanager(uid: string) {
  setupDataSources(
    mockDataSource<AlertManagerDataSourceJsonData>({
      name: uid,
      type: DataSourceType.Alertmanager,
      jsonData: { implementation: AlertManagerImplementation.mimir },
    })
  );
  return uid;
}
