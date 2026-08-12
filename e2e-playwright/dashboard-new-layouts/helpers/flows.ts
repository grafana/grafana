import test, { expect, type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import testV2Dashboard from '../../dashboards/TestV2Dashboard.json';
import { type Sidebar, type Controls } from '../page-objects';

/**
 * Multi-step user flows composed from page objects, grouped by domain
 * (`flows.dashboards.*`, `flows.variables.*`, `flows.navigation.*`).
 *
 * A flow IS a reusable sequence of user actions that several specs need
 * verbatim: test setup (provisioning, import), save-and-confirm cycles,
 * navigation to another page. Flows may wait and assert, but only to keep
 * their own sequence reliable (e.g. wait for a toast before closing it),
 * never to verify the behavior under test.
 *
 * A flow is NOT:
 * - a single interaction or locator lookup — that belongs to a page object;
 * - the assertion a spec exists to make — that stays in the spec (or in
 *   `assertions.ts` when the same assertion bundle is reused);
 * - pixel/timing-sensitive mechanics like drag-and-drop or `boundingBox()`
 *   geometry — those live in `utils.ts`.
 *
 * Add a new flow only when a second spec needs the same sequence, in the
 * domain namespace it acts on (create it if missing).
 */
export const flows = {
  dashboards: {
    async importTestDashboard(
      page: Page,
      selectors: E2ESelectorGroups,
      title: string,
      dashInput?: string,
      options: ImportTestDashboardOptions = {}
    ): Promise<string> {
      return test.step(`Import test dashboard "${title}"`, async () => {
        options = { checkPanelsVisible: true, requiresDataSourceSelection: true, ...options };

        await page.goto(selectors.pages.ImportDashboard.url);

        const importJson = stripMetadataNameFromImportJson(dashInput || JSON.stringify(testV2Dashboard));
        await page.getByTestId(selectors.components.DashboardImportPage.textarea).fill(importJson);
        await page.getByTestId(selectors.components.DashboardImportPage.submit).click();

        // we always append a timestamp so every import gets a unique title. Collisions happen on test retries
        // and when parallel workers import dashboards sharing the same title (several specs reuse titles like "Paste tab")
        // a collision does not fail the test (the import overwrites the existing dashboard),
        // but Playwright traces show a validation error in the UI and tests may run against a stale dashboard
        const uniqueTitle = `${title} [${Date.now().toString(36)}-${test.info().workerIndex}]`;
        await page.getByTestId(selectors.components.ImportDashboardForm.name).fill(uniqueTitle);

        if (options.requiresDataSourceSelection) {
          await page.getByTestId(selectors.components.DataSourcePicker.inputV2).click();
          await page.locator('div[data-testid^="data-testid data source card"]').first().click();
        }

        await page.getByTestId(selectors.components.ImportDashboardForm.submit).click();

        const undockMenuButton = page.locator('[aria-label="Undock menu"]');
        const undockMenuVisible = await undockMenuButton.isVisible();
        if (undockMenuVisible) {
          await undockMenuButton.click();
        }

        if (options.checkPanelsVisible) {
          // wait for the 1st panel to render
          await expect(page.locator('[data-testid="uplot-main-div"]').first()).toBeVisible();
        }

        return uniqueTitle;
      });
    },
    async saveDashboardAndCloseToast(page: Page, controls: Controls, title?: string) {
      await controls.saveDashboard(title);

      // wait for the toast
      const toast = page.getByRole('status', { name: 'Dashboard saved' });
      await expect(toast).toBeVisible();

      // close toast, we do this to prevent any incorrect assertion when several saves occur fast. i.e. the 1st toast is still visible but the 2nd save has not occurred yet
      await toast.getByRole('button', { name: 'Close alert' }).click();
    },
  },
  variables: {
    async addNewGenericVariable(
      page: Page,
      sidebar: Sidebar,
      controls: Controls,
      variable: Variable,
      skipEnterEditMode = false
    ) {
      if (!skipEnterEditMode) {
        await controls.enterEditMode();
      }

      await sidebar.toolbar.clickButton('Add');
      await sidebar.addOptions.clickNewVariableButton();

      await sidebar.variableOptions.selectVariableType(variable.type);

      // New variable creation schedules a delayed autofocus to name input
      // Let that timer finish before we interact to prevent focus on the wrong input
      await page.waitForTimeout(250);

      await sidebar.variableOptions.setName(variable.name);
      if (variable.label) {
        await sidebar.variableOptions.setLabel(variable.label);
      }
    },
    async addNewTextBoxVariable(page: Page, sidebar: Sidebar, controls: Controls, variable: Variable) {
      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.textbox.setValue(variable.value);
      if (variable.display) {
        await sidebar.variableOptions.selectDisplay(variable.display);
      }
    },
    async fillVariableValue(page: Page, controls: Controls, varName: string, text: string) {
      await controls.variables.setValue(varName, text);
      await page.waitForLoadState('networkidle');
    },
  },
  navigation: {
    async goToEmbeddedPanel(page: Page) {
      // extracting embedded panel url from UI
      const textAreaValue = await page.getByTestId('share-embed-html').evaluate((el) => el.textContent);
      const srcRegex = /src="([^"]*)"/;
      let soloPanelUrl = textAreaValue.match(srcRegex)?.[1];

      expect(soloPanelUrl).toBeDefined();

      // adjust base url (different each time in CI)
      const currentUrl = page.url();
      const baseUrlRegex = /^http:\/\/[^/:]+:3001\//;
      const baseUrl = currentUrl.match(baseUrlRegex)?.[0];
      soloPanelUrl = soloPanelUrl!.replace(baseUrlRegex, baseUrl!);

      await page.goto(soloPanelUrl!);
    },
  },
};

export type Variable = {
  type: string;
  name: string;
  label?: string;
  description?: string;
  value: string;
  display?: string;
};

type ImportTestDashboardOptions = {
  checkPanelsVisible?: boolean;
  requiresDataSourceSelection?: boolean;
};

function stripMetadataNameFromImportJson(input: string): string {
  // Keep fixture JSON intact, but remove a fixed resource name at import time so
  // each test creates an isolated dashboard via generateName in parallel runs.
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const metadata = Reflect.get(parsed, 'metadata');
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        Reflect.deleteProperty(metadata, 'name');
      }
    }
    return JSON.stringify(parsed);
  } catch {
    return input;
  }
}
