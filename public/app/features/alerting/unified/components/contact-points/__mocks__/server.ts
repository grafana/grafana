import { rest } from 'msw';
import { setupServer } from 'msw/node';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { ReceiversStateDTO } from 'app/types';

import alertmanagerMock from './alertmanager.config.mock.json';
import receiversMock from './receivers.mock.json';

import 'whatwg-fetch';

const server = setupServer(
  rest.get(`/api/alertmanager/grafana/config/api/v1/alerts`, (_req, res, ctx) =>
    res(ctx.json<AlertManagerCortexConfig>(alertmanagerMock))
  ),
  rest.get('/api/alertmanager/grafana/config/api/v1/receivers', (_req, res, ctx) =>
    res(ctx.json<ReceiversStateDTO[]>(receiversMock))
  )
);

export default server;
