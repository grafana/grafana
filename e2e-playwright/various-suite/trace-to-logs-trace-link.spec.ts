import { test, expect } from '@grafana/plugin-e2e';

test.use({
  openFeature: {
    flags: {
      'grafana.dynamicTraceToLogs': true,
    },
  },
});

type LokiQuery = { refId: string; expr: string; maxLines?: number };

const TRACE_ID = '75c665dfb6810000';
const TRACE_SERVICES = Array.from({ length: 10 }, (_, index) => `Service${index}`);

function logsFrame(refId: string) {
  return {
    schema: {
      refId,
      meta: { type: 'log-lines', typeVersion: [0, 0] },
      fields: [
        { name: 'labels', type: 'other', typeInfo: { frame: 'json.RawMessage' } },
        { name: 'Time', type: 'time', typeInfo: { frame: 'time.Time' } },
        { name: 'Line', type: 'string', typeInfo: { frame: 'string' } },
      ],
    },
    data: { values: [[{ service_name: 'Service3' }], [Date.now()], [`order placed trace_id=${TRACE_ID}`]] },
  };
}

test.describe(
  'Trace to logs',
  {
    tag: ['@various'],
  },
  () => {
    const dataSourceUids: string[] = [];

    test.afterEach(async ({ request }) => {
      for (const uid of dataSourceUids.splice(0)) {
        await request.delete(`/api/datasources/uid/${uid}`);
      }
    });

    test('links Logs for this trace to the logs of every service in the trace', async ({
      page,
      selectors,
      createDataSource,
    }) => {
      const suffix = Date.now();
      const logs = await createDataSource({ type: 'loki', name: `Trace logs ${suffix}` });
      dataSourceUids.push(logs.uid);
      const traces = await createDataSource({
        type: 'grafana-testdata-datasource',
        name: `Traces with logs ${suffix}`,
        jsonData: { tracesToLogsV2: { datasourceUid: logs.uid, customQuery: false } },
      });
      dataSourceUids.push(traces.uid);

      const lokiQueries: LokiQuery[] = [];
      await page.route('**/api/ds/query?ds_type=loki*', async (route) => {
        const queries: LokiQuery[] = route.request().postDataJSON().queries;
        lokiQueries.push(...queries);
        await route.fulfill({
          json: { results: Object.fromEntries(queries.map(({ refId }) => [refId, { frames: [logsFrame(refId)] }])) },
        });
      });

      const pane = {
        datasource: traces.uid,
        queries: [{ refId: 'A', datasource: { type: traces.type, uid: traces.uid }, scenarioId: 'trace' }],
        range: { from: 'now-1h', to: 'now' },
      };
      await page.goto(
        `${selectors.pages.Explore.url}?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify({ a: pane }))}`
      );

      const traceLogsQuery = `{service_name=~"${TRACE_SERVICES.join('|')}"} | logfmt | json | drop __error__ | trace_id="${TRACE_ID}"`;
      const logsForTrace = page.getByRole('button', { name: 'Logs for this trace' });
      await expect(logsForTrace).toBeEnabled();
      expect(lokiQueries[0]).toMatchObject({ refId: 't2l:default:trace_id', expr: traceLogsQuery, maxLines: 1 });

      await logsForTrace.click();

      await expect
        .poll(() => lokiQueries.filter((query) => query.maxLines !== 1).map((query) => query.expr))
        .toContain(traceLogsQuery);
    });
  }
);
