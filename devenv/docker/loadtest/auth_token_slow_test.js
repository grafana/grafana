import { sleep, check, group } from 'k6';
import { createClient, createBasicAuthClient } from './modules/client.js';
import { createTestOrgIfNotExists, createTestdataDatasourceIfNotExists } from './modules/util.js';

export let options = {
  noCookiesReset: true,
};

let endpoint = __ENV.URL || 'http://localhost:3000';
const slowQuery = __ENV.SLOW_QUERY && __ENV.SLOW_QUERY.length > 0 ? parseInt(__ENV.SLOW_QUERY, 10) : 5;
const client = createClient(endpoint);

export const setup = () => {
  const basicAuthClient = createBasicAuthClient(endpoint, 'admin', 'admin');
  const orgId = createTestOrgIfNotExists(basicAuthClient);
  const datasourceId = createTestdataDatasourceIfNotExists(basicAuthClient);
  client.withOrgId(orgId);
  return {
    orgId: orgId,
    datasourceId: datasourceId,
  };
};

export default data => {
  group(`user auth token slow test (queries between 1 and ${slowQuery} seconds)`, () => {
    if (__ITER === 0) {
      group('user authenticates thru ui with username and password', () => {
        let res = client.ui.login('admin', 'admin');

        check(res, {
          'response status is 200': r => r.status === 200,
          "response has cookie 'grafana_session' with 32 characters": r =>
            r.cookies.grafana_session[0].value.length === 32,
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
              scenarioId: 'slow_query',
              stringInput: `${Math.floor(Math.random() * slowQuery) + 1}s`,
              intervalMs: 10000,
              maxDataPoints: 433,
              datasourceId: data.datasourceId,
            },
          ],
        };

        requests.push({ method: 'GET', url: '/api/annotations?dashboardId=2074&from=1548078832772&to=1548082432772' });

        for (let n = 0; n < batchCount; n++) {
          requests.push({ method: 'POST', url: '/api/tsdb/query', body: payload });
        }

        let responses = client.batch(requests);
        for (let n = 0; n < batchCount; n++) {
          check(responses[n], {
            'response status is 200': r => r.status === 200,
          });
        }
      });
    }
  });

  sleep(5);
};

export const teardown = data => {};
