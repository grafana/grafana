import { HttpResponse, http } from 'msw';
import { SetupServer, setupServer } from 'msw/node';

export function registerAPIHandlers(): SetupServer {
  const server = setupServer(
    // TODO
    http.get('/api/cloudmigration/status', () => {
      return HttpResponse.json({
        enabled: false,
      });
    })
  );

  return server;
}
