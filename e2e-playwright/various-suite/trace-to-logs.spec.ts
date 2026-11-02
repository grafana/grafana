import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Trace to logs',
  {
    tag: ['@various'],
  },
  () => {
    test('links an expanded span to each configured logs destination', async ({
      page,
      selectors,
      createDataSource,
    }) => {
      test.slow();
      const suffix = Date.now();
      const applicationLogs = await createDataSource({ type: 'loki', name: `Application logs ${suffix}` });
      const auditLogs = await createDataSource({ type: 'loki', name: `Audit logs ${suffix}` });
      const destination = (name: string, datasourceUid: string) => ({
        name,
        datasourceUid,
        // The testdata trace scenario sets service.name on every span.
        tags: [{ key: 'service.name', value: 'service_name' }],
        filterByTraceID: true,
        customQuery: false,
      });
      const traces = await createDataSource({
        type: 'grafana-testdata-datasource',
        name: `Traces with multiple logs destinations ${suffix}`,
        jsonData: {
          tracesToLogsV2: destination('Application logs', applicationLogs.uid),
          tracesToLogsAdditional: [destination('Audit logs', auditLogs.uid)],
        },
      });

      await page.route('**/api/ds/query?ds_type=loki*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: { A: { frames: [] } } }),
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

      await page.getByRole('switch', { name: /Operation 1/ }).click();

      await expect(page.getByRole('link', { name: 'Application logs' })).toBeVisible();
      await page.getByRole('link', { name: 'Audit logs' }).click();

      await expect(
        page.getByTestId(selectors.components.QueryEditorRows.rows).getByText(`(${auditLogs.name})`, { exact: true })
      ).toBeVisible();
    });
  }
);
