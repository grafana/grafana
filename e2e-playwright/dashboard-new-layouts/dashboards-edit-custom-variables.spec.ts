import { type Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Panel, Sidebar } from './page-objects';
import { flows, type Variable } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard edit - Custom variable',
  {
    tag: ['@dashboards'],
  },
  () => {
    const checkPreview = async (previewOptions: Locator, labels: string[]) => {
      await test.step('Checking preview of values', async () => {
        for (let i = 0; i < labels.length; i++) {
          await expect(previewOptions.nth(i)).toHaveText(labels[i]);
        }
      });
    };

    test('can add a new custom variable', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      const variable: Variable & { label: string } = {
        type: 'custom',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: '',
      };

      await flows.addNewGenericVariable(page, dashboardPage, selectors, variable);

      await sidebar.variableOptions.custom.openEditor();
      await sidebar.variableOptions.custom.selectFormat('CSV');
      await sidebar.variableOptions.custom.setValues('first value, second label : second value, fourth value');

      await checkPreview(sidebar.variableOptions.custom.getPreviewOfValues(), [
        'first value',
        'second label',
        'fourth value',
      ]);
      await sidebar.variableOptions.custom.clickApplyButton();

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);
      await expect(controls.variables.getDropdownTrigger(variable.label)).toContainText('first value');

      // Assert the variable values are correctly displayed in the panel
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`${variable.name}: first value`);

      await sidebar.clickDeleteButton({ confirm: true });
      await expect(variableLabel).toBeHidden();
    });

    test('can edit a custom variable', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      const variable: Variable & { label: string } = {
        type: 'custom',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: '',
      };

      await flows.addNewGenericVariable(page, dashboardPage, selectors, variable);

      await sidebar.variableOptions.custom.openEditor();
      await sidebar.variableOptions.custom.selectFormat('CSV');
      await sidebar.variableOptions.custom.setValues('first value, second label : second value, fourth value');
      await sidebar.variableOptions.custom.clickApplyButton();

      // make sure the variable is deselected in order to ba able interact with the content outline item
      // if not, the item is selected and does not receive click events
      await sidebar.clickCloseButton();

      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.name);
      await sidebar.variableOptions.custom.openEditor();

      await sidebar.variableOptions.custom.setValues(
        'first value updated, second label updated : second value, fourth value'
      );

      await checkPreview(sidebar.variableOptions.custom.getPreviewOfValues(), [
        'first value updated',
        'second label updated',
        'fourth value',
      ]);
      await sidebar.variableOptions.custom.clickApplyButton();

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);
      await expect(controls.variables.getDropdownTrigger(variable.label)).toContainText('first value updated');

      // Assert the variable values are correctly displayed in the panel
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`${variable.name}: first value updated`);
    });

    test('can create a custom variable with multiple properties', async ({
      gotoDashboardPage,
      selectors,
      page,
      components,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      const variable: Variable & { label: string } = {
        type: 'custom',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: '',
      };

      await flows.addNewGenericVariable(page, dashboardPage, selectors, variable);

      const options = [
        { value: 'dev', text: 'Development', aws: 'us-east-1' },
        { value: 'prod', text: 'Production', aws: 'eu-west-1' },
      ];

      await sidebar.variableOptions.custom.openEditor();
      await sidebar.variableOptions.custom.selectFormat('JSON');
      await sidebar.variableOptions.custom.setValues(JSON.stringify(options));

      // The preview table renders one column per property and one row per option, in input order
      const previewTable = sidebar.variableOptions.custom.getPreviewTable();
      await expect(previewTable.getByRole('columnheader')).toHaveText(Object.keys(options[0]));

      const previewRows = previewTable.getByRole('row');
      await expect(previewRows).toHaveCount(options.length + 1); // + header row
      for (const [i, option] of options.entries()) {
        await expect(previewRows.nth(i + 1).getByRole('cell')).toHaveText(Object.values(option));
      }

      await sidebar.variableOptions.custom.clickApplyButton();

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);

      // The first option is selected by default; the panels interpolate its value and text
      const panelContents = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content);
      await expect(panelContents.first().locator('.markdown-html')).toContainText(`${variable.name}: dev`);
      await expect(panelContents.nth(1).locator('.markdown-html')).toContainText(`${variable.name}Text: Development`);

      // Retitle the first panel to verify the aws property can be interpolated via ${var.property}
      const panel = new Panel({ page, dashboardPage, selectors, components });
      await panel.selectByTitle('Panel Title');
      await sidebar.panelOptions.setTitle(`Panel Title - aws: \${${variable.name}.aws}`);
      await expect(panel.getHeaderByTitle(`Panel Title - aws: ${options[0].aws}`)).toBeVisible();
    });
  }
);
