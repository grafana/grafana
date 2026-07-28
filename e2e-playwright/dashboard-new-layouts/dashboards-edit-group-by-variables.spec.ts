import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Sidebar } from './page-objects';
import { flows, type Variable } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
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
    test('can add a new group by variable', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      const variable: Variable = {
        type: 'groupby',
        name: 'VariableUnderTest',
        value: 'label1',
        label: 'VariableUnderTest',
      };

      await flows.addNewGenericVariable(page, dashboardPage, selectors, variable);
      await sidebar.variableOptions.groupby.selectDatasource('gdev-e2etestdatasource');

      // Assert the variable dropdown is visible with correct label
      const variableLabel = controls.variables.getLabel(variable.label!);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label!);

      const labels = ['label1', 'label2'];

      // choose the label, then close the dropdown
      await controls.variables.selectOption(variable.label!, labels[1]);
      await page.locator('body').click();

      // assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${labels[1]}`);
    });
  }
);
