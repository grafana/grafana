import { type PropsWithChildren } from 'react';
import { getWrapper } from 'test/test-utils';

import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';

import { mockDataSource } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

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
