import { rest } from 'msw';
import { SetupServer } from 'msw/lib/node';

import { AlertmanagerStatus } from 'app/plugins/datasource/alertmanager/types';

import vanillaAlertManagerConfig from './alertmanager.vanilla.mock.json';

// this one emulates a mimir server setup
export const VANILLA_ALERTMANAGER_DATASOURCE_UID = 'alertmanager';

export default (server: SetupServer) => {
  server.use(
    rest.get(`/api/alertmanager/${VANILLA_ALERTMANAGER_DATASOURCE_UID}/api/v2/status`, (_req, res, ctx) =>
      res(ctx.json<AlertmanagerStatus>(vanillaAlertManagerConfig))
    ),
    // this endpoint will respond if the OnCall plugin is installed
    rest.get('/api/plugins/grafana-oncall-app/settings', (_req, res, ctx) => res(ctx.status(404)))
  );

  return server;
};
