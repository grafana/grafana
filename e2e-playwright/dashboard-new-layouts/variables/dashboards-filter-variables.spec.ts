import { type Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { flows } from '../helpers';

import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './helpers/flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
  },
});

async function mockPrometheusLabels(page: Page) {
  // Keep persistence coverage independent of a running Prometheus server in CI and local dev.
  await page.route(/\/gdev-prometheus\/resources\/api\/v1\/labels(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 200, json: { status: 'success', data: ['label1', 'label2'] } });
  });
  await page.route(/\/gdev-prometheus\/resources\/api\/v1\/label\/label2\/values(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 200, json: { status: 'success', data: ['label2Value1'] } });
  });
}

test.describe('Dashboard edit - Filter variables', { tag: ['@dashboards'] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockPrometheusLabels(page);
  });

  test('preserves a new Filter variable and its filter after save and reload', async ({
    page,
    selectors,
    controls,
    sidebar,
    panels,
  }) => {
    const viewUrl = await importVariableTestDashboard(page, selectors, panels);
    const variable = {
      name: 'VariableUnderTest',
      label: 'Saved filter',
      dataSource: 'gdev-prometheus',
    };

    await flows.variables.addNewFilterVariable(controls, sidebar, variable);
    await expect(sidebar.variableOptions.adhoc.getEnableGroupByCheckbox()).toBeChecked();

    await sidebar.variableOptions.adhoc.toggleGroupBy();
    await controls.variables.addFilter(variable.label, ['label2', '=', 'label2Value1']);
    await panels.getBody('Variable output').click();

    const filter = controls.variables.getFilter(variable.label, 'label2');
    const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
    await expect(filter).toHaveText('label2 = label2Value1');
    await expect(markdownContent).toContainText('VariableUnderTest: label2="label2Value1"');

    await saveAndGotoDashboardUrl(page, controls, viewUrl);

    await expect(controls.variables.getLabel(variable.label)).toHaveText(variable.label);
    await expect(filter).toHaveText('label2 = label2Value1');
    await expect(markdownContent).toContainText('VariableUnderTest: label2="label2Value1"');

    await controls.enterEditMode();
    await sidebar.toolbar.clickButton('Outline');
    await sidebar.contentOutline.toggleNode('Filters');
    await sidebar.contentOutline.clickItem(variable.label);

    await expect(sidebar.getPaneTitle()).toHaveText('Filter');
    await expect(sidebar.variableOptions.getNameInput()).toHaveValue(variable.name);
    await expect(sidebar.variableOptions.getLabelInput()).toHaveValue(variable.label);
    await expect(sidebar.variableOptions.adhoc.getDatasourceInput()).toHaveAttribute(
      'placeholder',
      variable.dataSource
    );
    // We use { checked: false } because @grafana/plugin-e2e's toBeChecked does not support .not: it waits the full timeout.
    await expect(sidebar.variableOptions.adhoc.getEnableGroupByCheckbox()).toBeChecked({ checked: false });
  });

  test('preserves a Filter variable with both a filter and a group-by key after save and reload', async ({
    page,
    selectors,
    controls,
    sidebar,
    panels,
  }) => {
    const viewUrl = await importVariableTestDashboard(page, selectors, panels);
    const variable = {
      name: 'VariableUnderTest',
      label: 'Saved filter and grouping',
      dataSource: 'gdev-prometheus',
    };

    await flows.variables.addNewFilterVariable(controls, sidebar, variable);
    await expect(sidebar.variableOptions.adhoc.getEnableGroupByCheckbox()).toBeChecked();

    await controls.variables.addFilter(variable.label, ['label2', '=', 'label2Value1']);
    await panels.getBody('Variable output').click();
    await controls.variables.addGroupBy(variable.label, 'label1');
    await panels.getBody('Variable output').click();

    const filter = controls.variables.getFilter(variable.label, 'label2');
    const groupBy = controls.variables.getGroupBy(variable.label, 'label1');
    const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
    await expect(filter).toHaveText('label2 = label2Value1');
    await expect(groupBy).toHaveText('label1');
    await expect(markdownContent).toContainText('VariableUnderTest: label2="label2Value1"');

    await saveAndGotoDashboardUrl(page, controls, viewUrl);

    await expect(filter).toHaveText('label2 = label2Value1');
    await expect(groupBy).toHaveText('label1');
    await expect(markdownContent).toContainText('VariableUnderTest: label2="label2Value1"');

    await controls.enterEditMode();
    await sidebar.toolbar.clickButton('Outline');
    await sidebar.contentOutline.toggleNode('Filters');
    await sidebar.contentOutline.clickItem(variable.label);

    await expect(sidebar.variableOptions.adhoc.getEnableGroupByCheckbox()).toBeChecked();
  });
});
