import { test, expect } from '@grafana/plugin-e2e';

import longTraceResponse from '../fixtures/long-trace-response.json';

test.describe(
  'Trace view',
  {
    tag: ['@various'],
  },
  () => {
    test('Can lazy load big traces', async ({ page, selectors }) => {
      // Mock the API response
      await page.route('**/api/ds/query?ds_type=jaeger*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(longTraceResponse),
        });
      });

      // Navigate to Explore page
      await page.goto(selectors.pages.Explore.url);

      // Select the Jaeger data source
      const dataSourcePicker = page.getByTestId(selectors.components.DataSourcePicker.container);
      await dataSourcePicker.click();
      const datasourceList = page.getByTestId(selectors.components.DataSourcePicker.dataSourceList);
      await datasourceList.getByText('gdev-jaeger').click();

      // Check that gdev-jaeger is visible in the query editor
      await expect(page.getByTestId('query-editor-row').getByText('(gdev-jaeger)')).toBeVisible();

      // Type the query
      const queryField = page
        .getByTestId(selectors.components.QueryField.container)
        .locator('[contenteditable="true"]');
      await queryField.fill('trace');

      // Use Shift+Enter to execute the query
      await queryField.press('Shift+Enter');

      // Wait for the trace viewer to be ready
      await expect(page.getByRole('switch', { name: /api\-gateway GET/ })).toBeVisible();

      // Note the scrolling element is actually the first child of the scroll view, but we can use the scroll wheel on this anyway
      const scrollEl = page.getByTestId(selectors.pages.Explore.General.scrollView);

      // Assert that the last span is not visible in th page - it should be lazily rendered as the user scrolls
      const lastSpan = page.getByRole('switch', { name: /metrics\-collector\-last\-span GET/ });
      await expect(lastSpan).not.toBeVisible();

      // Scroll until the "metrics-collector-last-span GET" switch is visible
      await expect(async () => {
        await scrollEl.hover();
        await page.mouse.wheel(0, 1000);
        await expect(lastSpan).toBeVisible({ timeout: 1 });
      }).toPass();
    });
  }
);
