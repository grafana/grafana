import { type Page } from '@playwright/test';

import { expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

export const TEXT_FLAGS = { 'grafana.newTextPanel': true, 'text.newFeatures': true };

export async function expectNewTextReloadsAfterFirstQuery(
  dashboard: DashboardPage,
  page: Page,
  selectors: E2ESelectorGroups,
  queryEditorNext: boolean
) {
  const editor = await dashboard.addPanel();
  await editor.setVisualization('Time series');
  const queries = queryEditorNext
    ? page.locator('[data-query-sidebar-card="A"]')
    : editor.getByGrafanaSelector(selectors.components.QueryEditorRows.rows);
  await expect(queries).toHaveCount(1);
  await editor.setVisualization('Text');
  const textEditor = page.getByTestId('TextNGEditor');
  await expect(textEditor).toBeVisible();
  await expect(queries).toHaveCount(0);
  await textEditor.locator('.cm-content').fill('Value: ${__value.raw}');

  const addQuery = queryEditorNext
    ? page.getByLabel('Add query', { exact: true })
    : editor.getByGrafanaSelector(selectors.components.QueryTab.addQuery);
  await addQuery.click();

  await expect(queries).toHaveCount(1);
  await expect(textEditor).toBeVisible();
  await expect(
    page.getByTestId('TextNGEditor-preview').frameLocator('iframe[title="Text panel content"]').locator('body')
  ).toContainText(/Value: -?\d+(?:\.\d+)?/);
}
