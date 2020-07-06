import { sleep, check, group } from 'k6';
import { createBasicAuthClient } from './modules/client.js';

export let options = {
  noCookiesReset: true,
};

let endpoint = __ENV.URL || 'http://localhost:10080/grafana';
const client = createBasicAuthClient(endpoint, 'user1', 'grafana');
client.withOrgId(1);

export const setup = () => {
  const adminClient = createBasicAuthClient(endpoint, 'admin', 'admin');
  let res = adminClient.datasources.getByName('gdev-prometheus');
  if (res.status !== 200) {
    throw new Error('Expected 200 response status when creating datasource');
  }

  return {
    datasourceId: res.json().id,
  };
};

export default data => {
  group('auth proxy test', () => {
    group('batch proxy requests', () => {
      const d = new Date();
      const batchCount = 300;
      const requests = [];
      const query = encodeURI('topk(5, max(scrape_duration_seconds) by (job))');
      const start = d.getTime() / 1000 - 3600;
      const end = d.getTime() / 1000;
      const step = 20;

      requests.push({ method: 'GET', url: '/api/annotations?dashboardId=8&from=1558670300607&to=1558691900607' });

      for (let n = 0; n < batchCount; n++) {
        requests.push({
          method: 'GET',
          url: `/api/datasources/proxy/${data.datasourceId}/api/v1/query_range?query=${query}&start=${start}&end=${end}&step=${step}`,
        });
      }

      let responses = client.batch(requests);
      for (let n = 0; n < batchCount; n++) {
        check(responses[n], {
          'response status is 200': r => r.status === 200,
        });
      }
    });
  });

  sleep(5);
};

export const teardown = data => {};
