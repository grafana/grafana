import {
  EXTERNAL_VANILLA_ALERTMANAGER_UID,
  PROVISIONED_MIMIR_ALERTMANAGER_UID,
} from 'app/features/alerting/unified/components/settings/__mocks__/server';
import {
  MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER,
  MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER,
} from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';

import { mockDataSource } from '../mocks';
import { DataSourceType } from '../utils/datasource';

export const mockDataSources = {
  /** basic vanilla alertmanager with nothing special */
  alertmanager: mockDataSource(
    {
      name: 'alertmanager',
      uid: 'alertmanager-uid',
      type: DataSourceType.Alertmanager,
      jsonData: { manageAlerts: true },
    },
    { alerting: true, module: 'core:plugin/alertmanager' }
  ),
  /**
   * ~Cloud Prometheus AM with implementation set appropriately, that means we can
   * expect this datasource to end up calling the `/status` endpoints when fetching AM config
   */
  alertmanagerPrometheus: mockDataSource<AlertManagerDataSourceJsonData>(
    {
      name: 'externalPrometheus',
      uid: 'externalPrometheus-uid',
      type: DataSourceType.Alertmanager,
      jsonData: {
        manageAlerts: true,
        implementation: AlertManagerImplementation.prometheus,
      },
    },
    { module: 'core:plugin/prometheus' }
  ),
  /**
   * _Prometheus_ datasource, not alertmanager
   */
  prometheus: mockDataSource<AlertManagerDataSourceJsonData>(
    {
      name: 'prometheus',
      uid: 'prometheus-uid',
      type: DataSourceType.Prometheus,
      jsonData: {
        manageAlerts: true,
        implementation: AlertManagerImplementation.prometheus,
      },
    },
    { alerting: true, module: 'core:plugin/prometheus' }
  ),
  /**
   * _Prometheus_ datasource that doesn't work properly
   */
  promBroken: mockDataSource<AlertManagerDataSourceJsonData>(
    {
      name: 'Prometheus-broken',
      uid: 'prometheus-broken-uid',
      type: DataSourceType.Prometheus,
      jsonData: {
        manageAlerts: true,
        implementation: AlertManagerImplementation.prometheus,
      },
    },
    { alerting: true, module: 'core:plugin/prometheus' }
  ),
  /**
   * Alertmanager using mimir implementation
   */
  mimir: mockDataSource<AlertManagerDataSourceJsonData>(
    {
      name: 'mimir',
      uid: 'mimir-uid',
      type: DataSourceType.Alertmanager,
      jsonData: {
        // this is a mutable data source type but we're making it readOnly
        implementation: AlertManagerImplementation.mimir,
      },
      readOnly: true,
    },
    { module: 'core:plugin/alertmanager' }
  ),
  loki: mockDataSource(
    {
      type: DataSourceType.Loki,
      uid: 'loki-uid',
      name: 'loki',
    },
    { alerting: true, module: 'core:plugin/loki' }
  ),
  [MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER]: mockDataSource({
    uid: MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER,
    name: MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER,
    type: DataSourceType.Alertmanager,
  }),
  [EXTERNAL_VANILLA_ALERTMANAGER_UID]: mockDataSource<AlertManagerDataSourceJsonData>(
    {
      uid: EXTERNAL_VANILLA_ALERTMANAGER_UID,
      name: EXTERNAL_VANILLA_ALERTMANAGER_UID,
      type: DataSourceType.Alertmanager,
      jsonData: {
        implementation: AlertManagerImplementation.prometheus,
      },
    },
    { module: 'core:plugin/alertmanager' }
  ),
  [PROVISIONED_MIMIR_ALERTMANAGER_UID]: mockDataSource<AlertManagerDataSourceJsonData>(
    {
      uid: PROVISIONED_MIMIR_ALERTMANAGER_UID,
      name: PROVISIONED_MIMIR_ALERTMANAGER_UID,
      type: DataSourceType.Alertmanager,
      jsonData: {
        implementation: AlertManagerImplementation.mimir,
      },
      readOnly: true,
    },
    { module: 'core:plugin/alertmanager' }
  ),
};
