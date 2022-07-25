import { sleep, check, group } from 'k6';
import { createClient, createBasicAuthClient } from './modules/client.js';
import { createTestOrgIfNotExists, createTestdataDatasourceIfNotExists } from './modules/util.js';

export let options = {
  noCookiesReset: true,
};

let endpoint = __ENV.URL || 'http://localhost:3000';
const client = createClient(endpoint);

export const setup = () => {
  const basicAuthClient = createBasicAuthClient(endpoint, 'admin', 'admin');
  const orgId = createTestOrgIfNotExists(basicAuthClient);
  basicAuthClient.withOrgId(orgId);
  const datasourceId = createTestdataDatasourceIfNotExists(basicAuthClient);
  return {
    orgId,
    datasourceId,
  };
};

export default (data) => {
  client.withOrgId(data.orgId);

  group('annotation by tag test', () => {
    if (__ITER === 0) {
      group('user authenticates through ui with username and password', () => {
        let res = client.ui.login('admin', 'admin');

        check(res, {
          'response status is 200': (r) => r.status === 200,
          "response has cookie 'grafana_session' with 32 characters": (r) =>
            r.cookies.grafana_session[0].value.length === 32,
        });
      });
    }

    if (__ITER !== 0) {
      group('batch tsdb requests with annotations by tag', () => {
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

        requests.push({ method: 'GET', url: '/api/annotations?from=1580825186534&to=1580846786535' });

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
