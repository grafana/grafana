import { test, expect } from '@grafana/plugin-e2e';

import traceResponse from '../fixtures/tempo-response.json';

test.describe(
  'Trace to logs',
  {
    tag: ['@various'],
  },
  () => {
    test('shows multiple logs destinations in the trace view', async ({
      page,
      selectors,
      components,
      createDataSource,
    }) => {
      const suffix = Date.now();
      const applicationLogs = await createDataSource({
        type: 'loki',
        name: `Application logs ${suffix}`,
      });
      const auditLogs = await createDataSource({
        type: 'loki',
        name: `Audit logs ${suffix}`,
      });
      const traceDataSourceName = `Traces with multiple logs destinations ${suffix}`;

      await createDataSource({
        type: 'jaeger',
        name: traceDataSourceName,
        jsonData: {
          tracesToLogsV3: [
            {
              name: 'Application logs',
              datasourceUid: applicationLogs.uid,
              customQuery: false,
              filterByTraceID: true,
            },
            {
              name: 'Audit logs',
              datasourceUid: auditLogs.uid,
              customQuery: false,
              filterByTraceID: true,
            },
          ],
        },
      });

      await page.route('**/api/ds/query?ds_type=jaeger*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(traceResponse),
        });
      });
      await page.route('**/api/ds/query?ds_type=loki*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: { A: { frames: [] } } }),
        });
      });

      await page.goto(selectors.pages.Explore.url);
      await components.dataSourcePicker.set(traceDataSourceName);

      const queryField = page
        .getByTestId(selectors.components.QueryField.container)
        .locator('[contenteditable="true"]');
      await queryField.fill('trace');
      await queryField.press('Shift+Enter');

      const rootSpan = page.getByRole('switch', { name: /lb HTTP Client/ });
      await expect(rootSpan).toBeVisible();

      await page.getByRole('button', { name: 'Span links' }).first().click();
      await expect(page.getByRole('menuitem', { name: 'Application logs' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Audit logs' })).toBeVisible();

      await page.keyboard.press('Escape');
      await rootSpan.click();

      const applicationLogsLink = page.getByRole('link', { name: 'Application logs' });
      await expect(applicationLogsLink).toBeVisible();
      await expect(page.getByRole('link', { name: 'Audit logs' })).toBeVisible();

      await applicationLogsLink.click();

      await expect(
        page
          .getByTestId(selectors.components.QueryEditorRows.rows)
          .getByText(`(${applicationLogs.name})`, { exact: true })
      ).toBeVisible();
    });
  }
);
