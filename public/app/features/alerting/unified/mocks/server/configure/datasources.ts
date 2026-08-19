import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

/**
 * Generic MSW handler for `/api/datasources`. Use when a test needs to control the datasource
 * list without going through the full `setupDataSources` test helper.
 */
export function setupDatasourcesEndpoint(server: SetupServer, datasources: object[]) {
  server.use(http.get('/api/datasources', () => HttpResponse.json(datasources)));
}
