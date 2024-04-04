import { http, HttpResponse } from 'msw';
import { SetupServerApi } from 'msw/lib/node';

import datasources from './api/datasources.json';
import admin_config from './api/v1/ngalert/admin_config.json';
import alertmanagers from './api/v1/ngalert/alertmanagers.json';

export { datasources as DataSourcesResponse };
export { admin_config as AdminConfigResponse };
export { alertmanagers as AlertmanagersResponse };

export function setupGrafanaManagedServer(server: SetupServerApi) {
  server.use(createAdminConfigHandler(), createExternalAlertmanagersHandler(), createAlertmanagerDataSourcesHandler());
}

const createAdminConfigHandler = () => http.get('/api/v1/ngalert/admin_config', () => HttpResponse.json(admin_config));

const createExternalAlertmanagersHandler = () =>
  http.get('/api/v1/ngalert/alertmanagers', () => HttpResponse.json(alertmanagers));

const createAlertmanagerDataSourcesHandler = () => http.get('/api/datasources', () => HttpResponse.json(datasources));

export const withExternalOnlySetting = (server: SetupServerApi) => {
  server.use(createAdminConfigHandler());
};
