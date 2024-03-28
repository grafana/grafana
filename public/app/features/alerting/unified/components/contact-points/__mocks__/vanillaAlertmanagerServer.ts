import 'whatwg-fetch';
import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/lib/node';

import { AlertmanagerStatus } from 'app/plugins/datasource/alertmanager/types';

import vanillaAlertManagerConfig from './alertmanager.vanilla.mock.json';

// this one emulates a mimir server setup
export const VANILLA_ALERTMANAGER_DATASOURCE_UID = 'alertmanager';

export default (server: SetupServer) => {
  server.use(
    http.get(`/api/alertmanager/${VANILLA_ALERTMANAGER_DATASOURCE_UID}/api/v2/status`, () =>
      HttpResponse.json<AlertmanagerStatus>(vanillaAlertManagerConfig)
    ),
    // this endpoint will respond if the OnCall plugin is installed
    http.get('/api/plugins/grafana-oncall-app/settings', () => HttpResponse.json({}, { status: 404 }))
  );

  return server;
};
