import { rest } from 'msw';
import { SetupServer } from 'msw/lib/node';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import mimirAlertmanagerMock from './alertmanager.mimir.config.mock.json';

// this one emulates a mimir server setup
export const MIMIR_DATASOURCE_UID = 'mimir';

export default (server: SetupServer) => {
  server.use(
    rest.get(`/api/alertmanager/${MIMIR_DATASOURCE_UID}/config/api/v1/alerts`, (_req, res, ctx) =>
      res(ctx.json<AlertManagerCortexConfig>(mimirAlertmanagerMock))
    ),
    rest.get(`/api/datasources/proxy/uid/${MIMIR_DATASOURCE_UID}/api/v1/status/buildinfo`, (_req, res, ctx) =>
      res(ctx.status(404))
    ),
    // this endpoint will respond if the OnCall plugin is installed
    rest.get('/api/plugins/grafana-oncall-app/settings', (_req, res, ctx) => res(ctx.status(404)))
  );

  return server;
};
