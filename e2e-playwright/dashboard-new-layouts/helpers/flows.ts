import test, { expect, type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import testV2Dashboard from '../../dashboards/TestV2Dashboard.json';
import { type Controls, type Sidebar } from '../page-objects';

/**
 * Multi-step user flows composed from page objects, grouped by domain
 * (`flows.dashboards.*`, `flows.variables.*`, `flows.contentOutline.*`, `flows.navigation.*`).
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
 * Add a new flow only when three specs need the same sequence, in the
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

        const uniqueTitle = buildUniqueDashboardTitle(title);
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
    /**
     * Saves via the save drawer, closes the success toast, and reloads by default.
     * Pass `reloadPageAfterSave: false` when the next step must keep the current page
     * (e.g. measure layout, exit edit mode, or navigate with goto).
     * Pass `title` only for a new (never saved) dashboard, or when you intentionally
     * want Save as with a new name. Omit it when the dashboard already has a title
     * (imported or previously saved) so the drawer does a plain Save.
     */
    async saveDashboard(
      page: Page,
      controls: Controls,
      { reloadPageAfterSave = true, title }: { reloadPageAfterSave?: boolean; title?: string } = {}
    ): Promise<string | undefined> {
      const uniqueTitle = title ? buildUniqueDashboardTitle(title) : undefined;
      const pathnameBeforeSave = new URL(page.url()).pathname;

      await controls.saveDashboard(uniqueTitle);

      // A first "Save"/"Save as" creates a new dashboard, then the app redirects to its /d/<uid> URL
      // so we wait for that redirect to make sure that a reload (or the next step) targets the saved dashboard
      if (uniqueTitle) {
        await expect(page, 'Expected a redirect to the newly saved dashboard').toHaveURL(
          (url) => url.pathname.startsWith('/d/') && url.pathname !== pathnameBeforeSave
        );
      }

      // wait for the toast
      const toast = page.getByRole('status', { name: 'Dashboard saved' });
      await expect(toast).toBeVisible();

      // close toast, we do this to prevent any incorrect assertion when several saves occur fast. i.e. the 1st toast is still visible but the 2nd save has not occurred yet
      await toast.getByRole('button', { name: 'Close alert' }).click();

      if (reloadPageAfterSave) {
        await page.reload();
      }

      return uniqueTitle;
    },
  },
  variables: {
    async addNewGenericVariable(sidebar: Sidebar, controls: Controls, variable: Variable, skipEnterEditMode = false) {
      if (!skipEnterEditMode) {
        await controls.enterEditMode();
      }

      await sidebar.toolbar.clickButton('Add');

      // Ad hoc filters are not in the variable type picker; they have their own "Filter and Group by" entry
      if (variable.type === 'adhoc') {
        await sidebar.addOptions.addFilter();
      } else {
        await sidebar.addOptions.addVariable();
        await sidebar.variableOptions.selectVariableType(variable.type);
        // Only the variable type picker autofocuses the name input; adding a Filter does not
        await expect(sidebar.variableOptions.getNameInput()).toBeFocused();
      }

      await sidebar.variableOptions.setName(variable.name);
      if (variable.label) {
        await sidebar.variableOptions.setLabel(variable.label);
      }
    },
    async addNewTextBoxVariable(sidebar: Sidebar, controls: Controls, variable: Variable) {
      await flows.variables.addNewGenericVariable(sidebar, controls, variable);

      await sidebar.variableOptions.textbox.setValue(variable.value);
      if (variable.display) {
        await sidebar.variableOptions.selectDisplay(variable.display);
      }
    },
    async addNewFilterVariable(
      controls: Controls,
      sidebar: Sidebar,
      variable: { name: string; label: string; dataSource: string }
    ): Promise<void> {
      await test.step('Create a Filter variable using unified controls', async () => {
        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Add');
        await sidebar.addOptions.addFilter();

        await sidebar.variableOptions.setName(variable.name);
        await sidebar.variableOptions.setLabel(variable.label);
        await sidebar.variableOptions.adhoc.selectDatasource(variable.dataSource);
      });
    },
    async fillVariableValue(page: Page, controls: Controls, varName: string, text: string) {
      await controls.variables.setValue(varName, text);
      await page.waitForLoadState('networkidle');
    },
    async delete(sidebar: Sidebar, variableLabel: string) {
      return test.step(`Delete variable "${variableLabel}"`, async () => {
        await flows.contentOutline.selectVariable(sidebar, variableLabel);
        await sidebar.deleteSelection({ confirm: true });
      });
    },
  },
  contentOutline: {
    /**
     * Opens the content outline and selects a variable from it, which shows the variable's pane in the sidebar.
     * The "Variables" node is toggled, not just expanded: call this once per page load, as the outline keeps its expanded state until a reload.
     * @param variableLabel the variable's label when set, otherwise its name
     */
    async selectVariable(sidebar: Sidebar, variableLabel: string) {
      await test.step(`Select variable "${variableLabel}" in the content outline`, async () => {
        await sidebar.toolbar.clickButton('Outline');
        await sidebar.contentOutline.toggleNode('Variables');
        await sidebar.contentOutline.clickItem(variableLabel);
      });
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

// we always append a timestamp so every import gets a unique title. Collisions happen on test retries
// and when parallel workers import dashboards sharing the same title
// a collision does not fail the test (the import overwrites the existing dashboard),
// but Playwright traces show a validation error in the UI and tests may run against a stale dashboard
const buildUniqueDashboardTitle = (title = test.info().title) =>
  `${title} [${Date.now().toString(36)}-${test.info().workerIndex}]`;
