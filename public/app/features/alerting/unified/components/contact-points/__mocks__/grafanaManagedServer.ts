import { rest } from 'msw';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { ReceiversStateDTO } from 'app/types';

import { setupMswServer } from '../../../mockApi';

import alertmanagerMock from './alertmanager.config.mock.json';
import receiversMock from './receivers.mock.json';

export default () => {
  const server = setupMswServer();

  server.use(
    // this endpoint is a grafana built-in alertmanager
    rest.get('/api/alertmanager/grafana/config/api/v1/alerts', (_req, res, ctx) =>
      res(ctx.json<AlertManagerCortexConfig>(alertmanagerMock))
    ),
    // this endpoint is only available for the built-in alertmanager
    rest.get('/api/alertmanager/grafana/config/api/v1/receivers', (_req, res, ctx) =>
      res(ctx.json<ReceiversStateDTO[]>(receiversMock))
    )
  );
};
