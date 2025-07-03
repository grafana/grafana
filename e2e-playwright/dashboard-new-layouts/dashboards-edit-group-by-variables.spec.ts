import { test, expect } from '@grafana/plugin-e2e';

import { flows, type Variable } from './utils';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard edit - Group By variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new group by variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const variable: Variable = {
        type: 'groupby',
        name: 'VariableUnderTest',
        value: 'label1',
        label: 'VariableUnderTest',
      };

      // common steps to add a new variable
      await flows.newEditPaneVariableClick(dashboardPage, selectors);
      await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, variable);

      // select datasource for the group by variable
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.dataSourceSelect)
        .click();
      const dataSource = 'gdev-loki';
      await page.getByText(dataSource).click();

      // mock the API call to get the labels
      const labels = ['label1', 'label2'];
      await page.route('**/resources/labels*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: labels,
          }),
        });
      });

      // open the variable dropdown in the dashboard and confirm the variable value is set
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem).locator('> div').click();
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!)
      );
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label!);

      // mock the API call to get the label values
      const labelValues = ['label2Value1'];
      await page.route(`**/resources/label/${labels[1]}/values*`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: labelValues,
          }),
        });
      });

      // choose the label and value
      await page.getByText(labels[1]).click();
      await page.keyboard.press('Escape');

      // assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${labels[1]}`);
    });
  }
);
