import { HttpResponse, http } from 'msw';
import { SetupServer, setupServer } from 'msw/node';

export function registerAPIHandlers(): SetupServer {
  const server = setupServer(
    // TODO
    http.get('/api/dashboards/uid/:uid', ({ request, params }) => {
      if (params.uid === 'dashboard-404') {
        return HttpResponse.json(
          {
            message: 'Dashboard not found',
          },
          {
            status: 404,
          }
        );
      }

      return HttpResponse.json({
        dashboard: {
          title: 'My Dashboard',
        },
        meta: {
          folderTitle: 'Dashboards',
        },
      });
    })
  );

  server.listen();

  return server;
}
