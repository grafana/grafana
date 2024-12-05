import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';

import { mockDataSource } from '../mocks';
import { DataSourceType } from '../utils/datasource';

export const mockDataSources = {
  /** basic vanilla alertmanager with nothing special */
  alertmanager: mockDataSource({
    name: 'alertmanager',
    uid: 'alertmanager-uid',
    type: DataSourceType.Alertmanager,
  }),
  /**
   * ~Cloud Prometheus AM with implementation set appropriately, that means we can
   * expect this datasource to end up calling the `/status` endpoints when fetching AM config
   */
  externalPrometheus: mockDataSource<AlertManagerDataSourceJsonData>(
    {
      name: 'externalPrometheus',
      uid: 'externalPrometheus-uid',
      type: DataSourceType.Alertmanager,
      jsonData: {
        implementation: AlertManagerImplementation.prometheus,
      },
    },
    { module: 'core:plugin/prometheus' }
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
};
