import { sleep, check, group } from 'k6';
import { createClient, createBasicAuthClient, createBearerAuthClient } from './modules/client.js';
import { createTestOrgIfNotExists, createTestdataDatasourceIfNotExists } from './modules/util.js';

export let options = {
  noCookiesReset: true,
};

let endpoint = __ENV.URL || 'http://localhost:3000';

let apiKey = __ENV.API_KEY;
if (!apiKey) {
  throw new Error('This script requires the API key argument -k to be defined.');
}
const client = createBearerAuthClient(endpoint, apiKey);

export const setup = () => {
  const authClient = createBearerAuthClient(endpoint, apiKey);

  const orgId = createTestOrgIfNotExists(authClient);
  authClient.withOrgId(orgId);
  const datasourceId = createTestdataDatasourceIfNotExists(authClient);

  return {
    orgId,
    datasourceId,
  };
};

export default (data) => {
  client.withOrgId(data.orgId);

  group('API key test', () => {
    if (__ITER === 0) {
      group('user can access grafana instance with APIKey', () => {
        let res = client.datasources.getAll();

        check(res, {
          'response status is 200': (r) => r.status === 200,
        });
      });
    }

    if (__ITER !== 0) {
      group('batch tsdb requests', () => {
        const batchCount = 20;
        const requests = [];
        const payload = {
          from: '1547765247624',
          to: '1547768847624',
          queries: [
            {
              refId: 'A',
              scenarioId: 'random_walk',
              intervalMs: 10000,
              maxDataPoints: 433,
              datasourceId: data.datasourceId,
            },
          ],
        };

        requests.push({ method: 'GET', url: '/api/annotations?dashboardId=2074&from=1548078832772&to=1548082432772' });

        for (let n = 0; n < batchCount; n++) {
          requests.push({ method: 'POST', url: '/api/ds/query', body: payload });
        }

        let responses = client.batch(requests);
        for (let n = 0; n < batchCount; n++) {
          check(responses[n], {
            'response status is 200': (r) => r.status === 200,
          });
        }
      });
    }
  });

  sleep(5);
};

export const teardown = (data) => {};
