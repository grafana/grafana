import { uniqueId } from 'lodash';
import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import { type DataSourceSettings } from '@grafana/data';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';

import { DataSourceType } from '../../../utils/datasource';

/**
 * Generic MSW handler for `/api/datasources`. Use when a test needs to control the datasource
 * list without going through the full `setupDataSources` test helper.
 */
export function setupDatasourcesEndpoint(server: SetupServer, datasources: object[]) {
  server.use(http.get('/api/datasources', () => HttpResponse.json(datasources)));
}

/**
 * Builds a `/api/datasources` (`DataSourceSettings`) REST payload with sensible defaults. This is
 * the shape returned by `getAllDataSourceSettings`, which is flatter than `DataSourceInstanceSettings`
 * and, unlike `mockDataSource`/`alertingFactory.dataSource`, has no runtime-registration side effects.
 */
function baseDataSourcePayload(): DataSourceSettings {
  const id = Number(uniqueId());
  return {
    id,
    uid: `ds-${id}`,
    orgId: 1,
    name: `Data source ${id}`,
    type: DataSourceType.Prometheus,
    typeName: 'Prometheus',
    typeLogoUrl: '',
    access: 'proxy',
    url: 'http://localhost:9090',
    user: '',
    database: '',
    basicAuth: false,
    basicAuthUser: '',
    isDefault: false,
    jsonData: {},
    secureJsonFields: {},
    readOnly: false,
    withCredentials: false,
  } satisfies DataSourceSettings;
}

/** A Mimir Alertmanager data source in the `/api/datasources` REST shape. */
export function mimirAlertmanagerDataSourcePayload(
  overrides?: Partial<DataSourceSettings<AlertManagerDataSourceJsonData>>
): DataSourceSettings<AlertManagerDataSourceJsonData> {
  const base = baseDataSourcePayload();
  return {
    ...base,
    uid: `mimir-am-${base.id}`,
    name: 'Test Mimir Alertmanager',
    type: DataSourceType.Alertmanager,
    typeName: 'Alertmanager',
    url: 'http://localhost:9009',
    jsonData: { implementation: AlertManagerImplementation.mimir },
    ...overrides,
  };
}
