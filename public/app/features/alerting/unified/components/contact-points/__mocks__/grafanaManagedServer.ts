import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

/** @deprecated */
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

/** @deprecated */
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
