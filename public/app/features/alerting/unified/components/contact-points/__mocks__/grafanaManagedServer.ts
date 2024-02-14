import 'whatwg-fetch';
import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

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
    http.get('/api/alertmanager/grafana/config/api/v1/alerts', () =>
      HttpResponse.json<AlertManagerCortexConfig>(alertmanagerMock)
    ),
    // this endpoint is only available for the built-in alertmanager
    http.get('/api/alertmanager/grafana/config/api/v1/receivers', () =>
      HttpResponse.json<ReceiversStateDTO[]>(receiversMock)
    ),
    // this endpoint will respond if the OnCall plugin is installed
    http.get('/api/plugins/grafana-oncall-app/settings', () => HttpResponse.json({}, { status: 404 }))
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

export const setupTestEndpointMock = (server: SetupServer) => {
  const mock = jest.fn();

  server.use(
    http.post(
      '/api/alertmanager/grafana/config/api/v1/receivers/test',
      async ({ request }) => {
        const requestBody = await request.json();
        mock(requestBody);

        return HttpResponse.json({});
      },
      {
        once: true,
      }
    )
  );

  return mock;
};

export const setupSaveEndpointMock = (server: SetupServer) => {
  const mock = jest.fn();

  server.use(
    http.post(
      '/api/alertmanager/grafana/config/api/v1/alerts',
      async ({ request }) => {
        const requestBody = await request.json();
        mock(requestBody);

        return HttpResponse.json({});
      },
      {
        once: true,
      }
    )
  );

  return mock;
};
