import { v4 as uuidv4 } from 'uuid';

import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Smoke tests',
  {
    tag: ['@acceptance'],
  },
  () => {
    test('Login, create test data source, create dashboard and panel scenario', async ({
      createDataSourceConfigPage,
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dataSourceConfigPage = await createDataSourceConfigPage({
        name: `e2e-${uuidv4()}`,
        type: 'grafana-testdata-datasource',
      });
      const { datasource } = dataSourceConfigPage;
      await dataSourceConfigPage.saveAndTest({
        path: `/api/datasources/uid/${datasource.uid}?accesscontrol=true`,
      });

      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

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
