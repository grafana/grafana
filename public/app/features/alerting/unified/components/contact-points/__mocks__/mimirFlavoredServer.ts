import { rest } from 'msw';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { setupMswServer } from '../../../mockApi';

import mimirAlertmanagerMock from './alertmanager.mimir.config.mock.json';

// this one emulates a mimir server setup
export default () => {
  const server = setupMswServer();

  server.use(
    rest.get('/api/alertmanager/grafana/config/api/v1/alerts', (_req, res, ctx) =>
      res(ctx.json<AlertManagerCortexConfig>(mimirAlertmanagerMock))
    )
  );
};
