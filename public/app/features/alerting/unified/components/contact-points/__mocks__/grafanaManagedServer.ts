import { rest } from 'msw';
import { SetupServer } from 'msw/lib/node';

import { AlertmanagerChoice, AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { ReceiversStateDTO } from 'app/types';

import { mockApi } from '../../../mockApi';
import { mockAlertmanagerChoiceResponse } from '../../../mocks/alertmanagerApi';
import { grafanaNotifiersMock } from '../../../mocks/grafana-notifiers';

import alertmanagerMock from './alertmanager.config.mock.json';
import receiversMock from './receivers.mock.json';

export default (server: SetupServer) => {
  server.use(
    // this endpoint is a grafana built-in alertmanager
    rest.get('/api/alertmanager/grafana/config/api/v1/alerts', (_req, res, ctx) =>
      res(ctx.json<AlertManagerCortexConfig>(alertmanagerMock))
    ),
    // this endpoint is only available for the built-in alertmanager
    rest.get('/api/alertmanager/grafana/config/api/v1/receivers', (_req, res, ctx) =>
      res(ctx.json<ReceiversStateDTO[]>(receiversMock))
    ),
    // this endpoint will respond if the OnCall plugin is installed
    rest.get('/api/plugins/grafana-oncall-app/settings', (_req, res, ctx) => res(ctx.status(404)))
  );

  // this endpoint is for rendering the "additional AMs to configure" warning
  mockAlertmanagerChoiceResponse(server, {
    alertmanagersChoice: AlertmanagerChoice.Internal,
    numExternalAlertmanagers: 1,
  });

  // mock the endpoint for contact point metadata
  mockApi(server).grafanaNotifiers(grafanaNotifiersMock);

  return server;
};
