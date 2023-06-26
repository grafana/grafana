import { rest } from 'msw';
import { SetupServer } from 'msw/node';

import {
  AlertManagerCortexConfig,
  ExternalAlertmanagersResponse,
} from '../../../../plugins/datasource/alertmanager/types';
import { AlertmanagersChoiceResponse } from '../api/alertmanagerApi';
import { getDatasourceAPIUid } from '../utils/datasource';

export function mockAlertmanagerChoiceResponse(server: SetupServer, response: AlertmanagersChoiceResponse) {
  server.use(rest.get('/api/v1/ngalert', (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
}

export function mockAlertmanagersResponse(server: SetupServer, response: ExternalAlertmanagersResponse) {
  server.use(rest.get('/api/v1/ngalert/alertmanagers', (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
}

export function mockAlertmanagerConfigResponse(
  server: SetupServer,
  alertManagerSourceName: string,
  response: AlertManagerCortexConfig
) {
  server.use(
    rest.get(`/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/alerts`, (req, res, ctx) =>
      res(ctx.status(200), ctx.json(response))
    )
  );
}
