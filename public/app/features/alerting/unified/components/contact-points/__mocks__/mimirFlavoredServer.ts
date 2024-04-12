import 'whatwg-fetch';
import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/lib/node';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import mimirAlertmanagerMock from './alertmanager.mimir.config.mock.json';

// this one emulates a mimir server setup
export const MIMIR_DATASOURCE_UID = 'mimir';

export default (server: SetupServer) => {
  server.use(
    http.get(`/api/alertmanager/${MIMIR_DATASOURCE_UID}/config/api/v1/alerts`, () =>
      HttpResponse.json(mimirAlertmanagerMock)
    ),
    http.get(`/api/datasources/proxy/uid/${MIMIR_DATASOURCE_UID}/api/v1/status/buildinfo`, () =>
      HttpResponse.json<AlertManagerCortexConfig>(
        {
          template_files: {},
          alertmanager_config: {},
        },
        { status: 404 }
      )
    ),
    // this endpoint will respond if the OnCall plugin is installed
    http.get('/api/plugins/grafana-oncall-app/settings', () => HttpResponse.json({}, { status: 404 }))
  );

  return server;
};
