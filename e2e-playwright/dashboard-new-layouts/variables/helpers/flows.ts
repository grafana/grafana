import test, { expect, type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { flows, type Variable } from '../../helpers';
import { type Controls, type Panels, type Sidebar } from '../../page-objects';
import variablePersistenceDashboard from '../fixtures/VariablePersistenceDashboard.json';

/**
 * Imports a variable test dashboard with a unique identity and returns its view URL
 * @param dashboard the v2 dashboard to import; it must have a "Variable output" markdown panel
 */
export async function importVariableTestDashboard(
  page: Page,
  selectors: E2ESelectorGroups,
  panels: Panels,
  dashboard: object = variablePersistenceDashboard
): Promise<string> {
  return test.step('Import an isolated variable test dashboard', async () => {
    await flows.dashboards.importTestDashboard(page, selectors, test.info().title, JSON.stringify(dashboard), {
      requiresDataSourceSelection: false,
      checkPanelsVisible: false,
    });

    await expect(panels.getBody('Variable output').locator('.markdown-html')).toBeVisible();

    const importedUrl = new URL(page.url());
    // We remove URL overrides because they can mask missing saved values, so the test verifies persistence.
    const viewUrl = new URL(importedUrl.pathname, importedUrl.origin);
    const orgId = importedUrl.searchParams.get('orgId');

    if (orgId !== null) {
      viewUrl.searchParams.set('orgId', orgId);
    }

    return viewUrl.toString();
  });
}

/**
 * Adds a custom variable and applies its values (enters edit mode first)
 * @param values the variable's values, written in the given format (e.g. "a, b, c" for CSV, a JSON array of options for JSON)
 */
export async function addNewCustomVariable(
  sidebar: Sidebar,
  controls: Controls,
  variable: Omit<Variable, 'type' | 'value'>,
  { format, values }: { format: 'CSV' | 'JSON'; values: string }
): Promise<void> {
  await test.step(`Add custom variable "${variable.name}"`, async () => {
    await flows.variables.addNewGenericVariable(sidebar, controls, { ...variable, type: 'custom', value: '' });
    await sidebar.variableOptions.custom.openEditor();
    await sidebar.variableOptions.custom.selectFormat(format);
    await sidebar.variableOptions.custom.setValues(values);
    await sidebar.variableOptions.custom.applyChanges();
  });
}

/**
 * Adds a variable scoped to the selected row or tab, through the section's options pane
 * @param sectionOptions `sidebar.rowOptions` or `sidebar.tabOptions`, matching the selected section
 */
export async function addNewSectionVariable(
  sidebar: Sidebar,
  sectionOptions: Sidebar['rowOptions'] | Sidebar['tabOptions'],
  variable: Omit<Variable, 'value'>
): Promise<void> {
  await test.step(`Add section variable "${variable.name}"`, async () => {
    await sectionOptions.addVariable();
    await sidebar.variableOptions.selectVariableType(variable.type);

    await expect(sidebar.variableOptions.getNameInput()).toBeFocused();

    await sidebar.variableOptions.setName(variable.name);
    if (variable.label) {
      await sidebar.variableOptions.setLabel(variable.label);
    }
  });
}

export async function saveAndGotoDashboardUrl(page: Page, controls: Controls, viewUrl: string): Promise<void> {
  await test.step('Save and go to the dashboard', async () => {
    await flows.dashboards.saveDashboard(page, controls, { reloadPageAfterSave: false });
    await page.goto(viewUrl);
  });
}
