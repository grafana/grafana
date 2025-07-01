import { test, expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

interface Variable {
  type: string;
  name: string;
  label?: string;
  description?: string;
  value: string;
}

test.describe(
  'Dashboard edit - Ad hoc variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new adhoc variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const variable: Variable = {
        type: 'adhoc',
        name: 'VariableUnderTest',
        value: 'label1',
        label: 'VariableUnderTest',
      };

      // Navigate to variables settings to add new variable
      await addNewAdHocVariable(dashboardPage, selectors, variable);

      // Select datasource for the ad hoc variable
      const dataSource = 'gdev-loki';
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.datasourceSelect)
        .click();
      await page.getByText(dataSource).click();

      // mock the API call to get the labels
      const labels = ['label1', 'label2'];
      const labelValues = ['label2Value1'];
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

      // Select the variable in the dashboard and confirm the variable value is set
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem).click();
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!)
      );
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label!);

      // mock the API call to get the label values
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
      await page.getByText('=', { exact: true }).click();
      await page.getByText(labelValues[0]).click();
      await page.keyboard.press('Escape');

      // assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${labels[1]}="${labelValues[0]}"`);
    });
  }
);

// Helper function to add a new ad hoc variable
async function addNewAdHocVariable(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, variable: Variable) {
  // Enter edit mode and navigate to variables
  await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.section).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item('Variables')).click();

  // Add new variable
  await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.addVariableButton).click();
  await dashboardPage
    .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.variableType(variable.type))
    .click();
  await dashboardPage
    .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.variableNameInput)
    .fill(variable.name);
  if (variable.label) {
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.variableLabelInput)
      .fill(variable.label);
  }
}
