import test, { expect, type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { flows } from '../helpers';
import { type Controls, type Panels } from '../page-objects';

import variablePersistenceDashboard from './fixtures/VariablePersistenceDashboard.json';

export async function importVariableTestDashboard(
  page: Page,
  selectors: E2ESelectorGroups,
  panels: Panels
): Promise<string> {
  return test.step('Import an isolated variable test dashboard', async () => {
    await flows.dashboards.importTestDashboard(
      page,
      selectors,
      test.info().title,
      JSON.stringify(variablePersistenceDashboard),
      {
        requiresDataSourceSelection: false,
        checkPanelsVisible: false,
      }
    );

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

export async function saveAndGotoDashboardUrl(page: Page, controls: Controls, viewUrl: string): Promise<void> {
  await test.step('Save and go to the dashboard', async () => {
    await flows.dashboards.saveDashboard(page, controls, { reloadPageAfterSave: false });
    await page.goto(viewUrl);
  });
}
