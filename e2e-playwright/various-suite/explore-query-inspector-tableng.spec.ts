import { test, expect } from '@grafana/plugin-e2e';

test.use({
  openFeature: {
    flags: {
      'table.inspectDataTableNG': true,
    },
  },
});

test.describe('Explore query inspector: Data tab with TableNG', { tag: ['@various'] }, () => {
  test('Data tab renders the query result in TableNG', async ({ page, dashboardPage, selectors }) => {
    await page.goto('/explore');

    const scenarioSelectContainer = dashboardPage.getByGrafanaSelector(
      selectors.components.DataSource.TestData.QueryTab.scenarioSelectContainer
    );
    await scenarioSelectContainer.locator('input[id*="test-data-scenario-select-"]').click();
    await page.getByText('CSV Metric Values').click();
    await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();

    await page.getByRole('button', { name: 'Query inspector' }).click();
    const inspector = dashboardPage.getByGrafanaSelector(selectors.pages.Explore.QueryInspector.container);
    await inspector.getByRole('tab', { name: 'Data' }).click();

    const grid = inspector.locator('.rdg:not([aria-hidden="true"])');
    await expect(grid.getByRole('columnheader').getByRole('button')).toHaveText(['time', 'A-series']);
    // CSV Metric Values defaults to 1,20,90,30,5,0 spread across the time range.
    await expect(grid.getByRole('row')).toHaveCount(7);
    await expect(grid.locator('[role="gridcell"][aria-colindex="2"]')).toHaveText(['1', '20', '90', '30', '5', '0']);
    await expect(grid.locator('[role="gridcell"][aria-colindex="1"]').first()).toHaveText(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
    );
  });
});
