import { HttpResponse, http } from 'msw';
import { SetupServer } from 'msw/node';

import { AlertmanagerStatus } from 'app/plugins/datasource/alertmanager/types';

import vanillaAlertManagerConfig from './alertmanager.vanilla.mock.json';

// this one emulates a mimir server setup
export const VANILLA_ALERTMANAGER_DATASOURCE_UID = 'alertmanager';

export default (server: SetupServer) => {
  server.use(
    http.get(`/api/alertmanager/${VANILLA_ALERTMANAGER_DATASOURCE_UID}/api/v2/status`, () =>
      HttpResponse.json<AlertmanagerStatus>(vanillaAlertManagerConfig)
    )
  );

  return server;
};
