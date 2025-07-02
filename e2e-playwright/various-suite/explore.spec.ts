import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Explore',
  {
    tag: ['@various'],
  },
  () => {
    test('Basic path through Explore.', async ({ page, dashboardPage, selectors }) => {
      await page.goto('/explore');

      const exploreContainer = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.General.container);
      await expect(exploreContainer).toHaveCount(1);

      const refreshButton = dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2);
      await expect(refreshButton).toHaveCount(1);

      const scenarioSelectContainer = dashboardPage.getByGrafanaSelector(
        selectors.components.DataSource.TestData.QueryTab.scenarioSelectContainer
      );
      await expect(scenarioSelectContainer).toBeVisible();
      await scenarioSelectContainer.scrollIntoViewIfNeeded();

      const scenarioInput = scenarioSelectContainer.locator('input[id*="test-data-scenario-select-"]');
      await expect(scenarioInput).toBeVisible();
      await scenarioInput.click();

      const csvMetricValues = page.locator('text=CSV Metric Values');
      await expect(csvMetricValues).toBeVisible();
      await csvMetricValues.scrollIntoViewIfNeeded();
      await csvMetricValues.click();
    });
  }
);
