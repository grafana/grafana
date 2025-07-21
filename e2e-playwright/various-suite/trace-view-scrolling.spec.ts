import { readFileSync } from 'fs';
import { join } from 'path';

import { test, expect } from '@grafana/plugin-e2e';

// this test requires a larger viewport
test.use({
  viewport: { width: 1280, height: 1080 },
});

// TODO for some reason, this test gives "connection refused" errors in CI
test.describe.skip(
  'Trace view',
  {
    tag: ['@various'],
  },
  () => {
    test('Can lazy load big traces', async ({ page, selectors }) => {
      // Load the fixture data
      const fixturePath = join(__dirname, '../fixtures/long-trace-response.json');
      const longTraceResponse = JSON.parse(readFileSync(fixturePath, 'utf8'));

      // Mock the API response
      await page.route('*/**/api/traces/trace', async (route) => {
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
      await expect(page.getByText('gdev-jaeger')).toBeVisible();

      // Type the query
      const queryField = page
        .getByTestId(selectors.components.QueryField.container)
        .locator('[contenteditable="true"]');
      await queryField.fill('trace');

      // Use Shift+Enter to execute the query
      await queryField.press('Shift+Enter');

      // Get the initial count of span bars
      const initialSpanBars = page.getByTestId(selectors.components.TraceViewer.spanBar);
      const initialSpanBarCount = await initialSpanBars.count();

      await initialSpanBars.last().scrollIntoViewIfNeeded();
      await expect
        .poll(async () => await page.getByTestId(selectors.components.TraceViewer.spanBar).count())
        .toBeGreaterThan(initialSpanBarCount);
    });
  }
);
