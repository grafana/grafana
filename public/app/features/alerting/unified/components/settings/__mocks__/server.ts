import { delay, http, HttpResponse } from 'msw';
import { SetupServerApi } from 'msw/lib/node';

import internalAlertmanagerConfig from './api/alertmanager/grafana/config/api/v1/alerts.json';
import history from './api/alertmanager/grafana/config/history.json';
import datasources from './api/datasources.json';
import admin_config from './api/v1/ngalert/admin_config.json';
import alertmanagers from './api/v1/ngalert/alertmanagers.json';

export { datasources as DataSourcesResponse };
export { admin_config as AdminConfigResponse };
export { alertmanagers as AlertmanagersResponse };
export { internalAlertmanagerConfig as InternalAlertmanagerConfiguration };
export { history as alertmanagerConfigurationHistory };

export function setupGrafanaManagedServer(server: SetupServerApi) {
  server.use(
    createAdminConfigHandler(),
    createExternalAlertmanagersHandler(),
    createAlertmanagerDataSourcesHandler(),
    ...createAlertmanagerConfigurationHandlers(),
    createAlertmanagerHistoryHandler()
  );
}

const createAdminConfigHandler = () => http.get('/api/v1/ngalert/admin_config', () => HttpResponse.json(admin_config));

const createExternalAlertmanagersHandler = () => {
  return http.get('/api/v1/ngalert/alertmanagers', () => HttpResponse.json(alertmanagers));
};

const createAlertmanagerConfigurationHandlers = (name = 'grafana') => {
  return [
    http.get(`/api/alertmanager/${name}/config/api/v1/alerts`, () => HttpResponse.json(internalAlertmanagerConfig)),
    http.post(`/api/alertmanager/${name}/config/api/v1/alerts`, async () => {
      await delay(1000); // simulate some time
      return HttpResponse.json({ message: 'configuration created' });
    }),
  ];
};

const createAlertmanagerDataSourcesHandler = () => http.get('/api/datasources', () => HttpResponse.json(datasources));
const createAlertmanagerHistoryHandler = (name = 'grafana') =>
  http.get(`/api/alertmanager/${name}/config/history`, () => HttpResponse.json(history));

export const withExternalOnlySetting = (server: SetupServerApi) => {
  server.use(createAdminConfigHandler());
};
