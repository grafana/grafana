import { HttpResponse, http } from 'msw';
import { SetupServer, setupServer } from 'msw/node';

import { validCloudMigrationToken } from './tokens';

function createMockAPI(): SetupServer {
  const server = setupServer(
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
    }),

    http.get('/api/library-elements/:uid', ({ request, params }) => {
      if (params.uid === 'library-element-404') {
        return HttpResponse.json(
          {
            message: 'Library element not found',
          },
          {
            status: 404,
          }
        );
      }

      return HttpResponse.json({
        result: {
          name: 'My Library Element',
          meta: {
            folderName: 'FolderName',
          },
        },
      });
    }),

    http.post('/api/cloudmigration/migration', async ({ request }) => {
      const data = await request.json();
      const authToken = typeof data === 'object' && data && data.authToken;

      if (authToken === validCloudMigrationToken) {
        return HttpResponse.json({
          created: new Date().toISOString(),
          id: 1,
          stack: 'abc-123',
        });
      }

      return HttpResponse.json(
        {
          message: 'Invalid token',
        },
        { status: 500 }
      );
    })
  );

  server.listen();

  return server;
}

export function registerMockAPI() {
  let server: SetupServer;

  beforeAll(() => {
    server = createMockAPI();
  });

  afterAll(() => {
    server.close();
  });
}
