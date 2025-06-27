import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Smoke tests',
  {
    tag: ['@smoke'],
  },
  () => {
    test('Login, create dashboard and panel scenario', async ({ dashboardPage, selectors, page }) => {
      // TODO need to add a datasource here

      // Create new dashboard
      await dashboardPage.goto();

      // Add new panel
      await dashboardPage.addPanel();

      // Select CSV Metric Values scenario
      const scenarioSelect = dashboardPage.getByGrafanaSelector(
        selectors.components.DataSource.TestData.QueryTab.scenarioSelectContainer
      );
      await expect(scenarioSelect).toBeVisible();
      await scenarioSelect.locator('input[id*="test-data-scenario-select-"]').click();
      await page.getByText('CSV Metric Values').click();

      // Verify the graph renders by checking legend
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();

      // Verify panel is added to dashboard
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'))
      ).toBeVisible();
    });
  }
);
