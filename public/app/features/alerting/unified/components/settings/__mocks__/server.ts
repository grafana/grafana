import { HttpResponse, delay, http } from 'msw';
import { SetupServerApi } from 'msw/node';

import {
  AlertManagerCortexConfig,
  AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
  AlertmanagerReceiver,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';

import { mockDataSource } from '../../../mocks';
import { DataSourceType } from '../../../utils/datasource';

import internalAlertmanagerConfig from './api/alertmanager/grafana/config/api/v1/alerts.json';
import history from './api/alertmanager/grafana/config/history.json';
import cloudAlertmanagerConfig from './api/alertmanager/provisioned/config/api/v1/alerts.json';
import vanillaAlertmanagerConfig from './api/alertmanager/vanilla prometheus/api/v2/status.json';
import datasources from './api/datasources.json';
import admin_config from './api/v1/ngalert/admin_config.json';
import alertmanagers from './api/v1/ngalert/alertmanagers.json';

export const EXTERNAL_VANILLA_ALERTMANAGER_UID = 'vanilla-alertmanager';
export const PROVISIONED_MIMIR_ALERTMANAGER_UID = 'provisioned-alertmanager';

export const mockDataSources = {
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
        // this is a mutable data source type but we're making it readOnly
        implementation: AlertManagerImplementation.mimir,
      },
      readOnly: true,
    },
    { module: 'core:plugin/alertmanager' }
  ),
};

export function setupGrafanaManagedServer(server: SetupServerApi) {
  server.use(
    createAdminConfigHandler(),
    createExternalAlertmanagersHandler(),
    createAlertmanagerDataSourcesHandler(),
    ...createAlertmanagerConfigurationHandlers(),
    createAlertmanagerHistoryHandler()
  );

  return server;
}

export function setupVanillaAlertmanagerServer(server: SetupServerApi) {
  server.use(
    createVanillaAlertmanagerConfigurationHandler(EXTERNAL_VANILLA_ALERTMANAGER_UID),
    ...createAlertmanagerConfigurationHandlers()
  );

  return server;
}

const createAdminConfigHandler = () => http.get('/api/v1/ngalert/admin_config', () => HttpResponse.json(admin_config));

const createExternalAlertmanagersHandler = () => {
  return http.get('/api/v1/ngalert/alertmanagers', () => HttpResponse.json(alertmanagers));
};

const createAlertmanagerConfigurationHandlers = () => {
  // Dirty check to type guard against us having a non-Grafana managed receiver
  const contactPointIsAMReceiver = (receiver: Receiver): receiver is AlertmanagerReceiver => {
    return !receiver.grafana_managed_receiver_configs;
  };

  return [
    http.get<{ name: string }>(`/api/alertmanager/:name/config/api/v1/alerts`, ({ params }) => {
      if (params.name === 'grafana') {
        return HttpResponse.json(internalAlertmanagerConfig);
      }
      return HttpResponse.json(cloudAlertmanagerConfig);
    }),
    http.post<never, AlertManagerCortexConfig>(`/api/alertmanager/:name/config/api/v1/alerts`, async ({ request }) => {
      await delay(1000); // simulate some time

      // Specifically mock and check for the case of an invalid telegram config,
      // and return a 400 error in this case
      // This is to test against us accidentally sending a `{label, value}` object instead of a string
      const body = await request.json();
      const invalidConfig = body.alertmanager_config.receivers?.some((receiver) => {
        if (!contactPointIsAMReceiver(receiver)) {
          return false;
        }

        const invalidParseMode = (receiver.telegram_configs || []).some(
          (config) => typeof config.parse_mode === 'object'
        );
        const invalidChatId = (receiver.telegram_configs || []).some((config) => Number(config.chat_id) >= 0);

        return invalidParseMode || invalidChatId;
      });

      if (invalidConfig) {
        return HttpResponse.json({ message: 'bad request data' }, { status: 400 });
      }

      return HttpResponse.json({ message: 'configuration created' });
    }),
  ];
};

const createAlertmanagerDataSourcesHandler = () => http.get('/api/datasources', () => HttpResponse.json(datasources));
const createAlertmanagerHistoryHandler = (name = 'grafana') =>
  http.get(`/api/alertmanager/${name}/config/history`, () => HttpResponse.json(history));

const createVanillaAlertmanagerConfigurationHandler = (dataSourceUID: string) =>
  http.get(`/api/alertmanager/${dataSourceUID}/api/v2/status`, () => HttpResponse.json(vanillaAlertmanagerConfig));

export const withExternalOnlySetting = (server: SetupServerApi) => {
  server.use(createAdminConfigHandler());
};
