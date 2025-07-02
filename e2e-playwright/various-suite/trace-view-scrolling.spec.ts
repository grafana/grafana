import { readFileSync } from 'fs';
import { join } from 'path';

import { test, expect } from '@grafana/plugin-e2e';

// TODO: fix the test. Currently not sensing more spans after scrolling.
test.describe.skip(
  'Trace view',
  {
    tag: ['@various', '@wip'],
  },
  () => {
    test('Can lazy load big traces', async ({ page, selectors }) => {
      // Load the fixture data
      const fixturePath = join(__dirname, '../fixtures/long-trace-response.json');
      const longTraceResponse = JSON.parse(readFileSync(fixturePath, 'utf8'));

      // Mock the API response
      await page.route('**/api/traces/trace', async (route) => {
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
      await expect(dataSourcePicker).toBeVisible();
      await dataSourcePicker.click();

      // Type the data source name and press Enter
      const dataSourceInput = page.getByTestId(selectors.components.DataSourcePicker.inputV2);
      await dataSourceInput.fill('gdev-jaeger');
      await dataSourceInput.press('Enter');

      // Check that gdev-jaeger is visible in the query editor
      await expect(page.locator('text=gdev-jaeger')).toBeVisible();

      // Type the query with no delay to prevent flaky tests
      const queryField = page.getByTestId(selectors.components.QueryField.container);
      await expect(queryField).toBeVisible();
      await queryField.click();
      await page.keyboard.type('trace');

      // Use Shift+Enter to execute the query
      await queryField.press('Shift+Enter');

      // Wait for the trace viewer to load
      const spanBar = page.getByTestId(selectors.components.TraceViewer.spanBar);
      //   await expect(spanBar).toBeVisible();

      // Get the initial count of span bars
      const initialSpanCount = await spanBar.count();

      const scrollElement = page.getByTestId(selectors.pages.Explore.General.scrollView);
      expect(scrollElement).toBeVisible();
      await scrollElement.hover();

      await page.mouse.wheel(0, 2000);

      // After scrolling we should load more spans
      const newSpanCount = await spanBar.count();
      expect(newSpanCount).toBeGreaterThan(initialSpanCount);
    });
  }
);
