import { type Locator, type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups, expect, test } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/TestV2Dashboard.json';

import type { Controls, Panels, Rows, Sidebar, Tabs } from './page-objects';

export const flows = {
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
    await flows.addNewGenericVariable(page, sidebar, controls, variable);

    await sidebar.variableOptions.textbox.setValue(variable.value);
    if (variable.display) {
      await sidebar.variableOptions.selectDisplay(variable.display);
    }
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

export async function saveDashboardAndCloseToast(page: Page, controls: Controls, title?: string) {
  await controls.saveDashboard(title);

  // wait for the toast
  const toast = page.getByRole('status', { name: 'Dashboard saved' });
  await expect(toast).toBeVisible();
  // close toast, we do this to prevent any incorrect assertion when several saves occur fast. i.e. the 1st toast is still visible but the 2nd save has not occurred yet
  await toast.getByRole('button', { name: 'Close alert' }).click();
}

export async function checkRepeatedPanelTitles(
  panels: Panels,
  title: string,
  values: Array<string | number>,
  expectHidden = false
) {
  for (const value of values) {
    if (expectHidden) {
      await expect(panels.getPanel(`${title}${value}`)).toBeHidden();
    } else {
      await expect(panels.getPanel(`${title}${value}`)).toBeVisible();
    }
  }
}

export async function movePanel(panels: Panels, sourcePanel: string | RegExp, targetPanel: string | RegExp) {
  await test.step(`Move panel "${sourcePanel}" onto "${targetPanel}"`, async () => {
    // Perform drag and drop; pixel-sensitive mechanics stay out of page objects
    await panels.getHeader(sourcePanel).dragTo(panels.getHeader(targetPanel));
  });
}

export async function getPanelBox(
  panels: Panels,
  panelTitle: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  // boundingBox() is a point-in-time snapshot and stays out of page objects;
  // measures the whole panel <section>, matched exactly by testid
  const boundingBox = await panels.getPanel(panelTitle).boundingBox();
  expect(boundingBox, `Panel "${panelTitle}" should have a bounding box`).not.toBeNull();

  return boundingBox!;
}

export async function verifyChanges(
  dashboardPage: DashboardPage,
  page: Page,
  selectors: E2ESelectorGroups,
  changeText: string
) {
  await test.step('Verify JSON diff in save drawer', async () => {
    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
    await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Changes')).click();
    await expect(page.getByText('Full JSON diff').locator('..')).toContainText(changeText);
    await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.General.close).click();
  });
}
interface ImportTestDashboardOptions {
  checkPanelsVisible?: boolean;
  requiresDataSourceSelection?: boolean;
}

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

export async function importTestDashboard(
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
}

export async function goToEmbeddedPanel(page: Page) {
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
}

/**
 * Coordinate-based drag: hover the source, press, move in steps, release.
 * Playwright's locator.dragTo() does not trigger the dnd library (pangea) used by
 * tabs/rows, which requires intermediate mousemove events.
 */
export async function dragTo(
  page: Page,
  sourceName: string,
  source: Locator,
  toX: number,
  toY: number,
  options?: { steps?: number }
) {
  await test.step(`Drag ${sourceName} to (${toX}, ${toY})`, async () => {
    await source.hover();
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: options?.steps ?? 5 });
    await page.mouse.up();
  });
}

export async function moveTab(page: Page, tabs: Tabs, sourceTab: string, targetTab: string) {
  await test.step(`Move tab "${sourceTab}" onto "${targetTab}"`, async () => {
    const targetBox = await getTabBox(tabs, targetTab);
    const sourceTabElement = tabs.getTitle(sourceTab).first();

    // Perform drag and drop (dragTo() did not work in this case)
    await sourceTabElement.hover();
    await page.mouse.down();
    // move to adjusted target position (relative to top left)
    await page.mouse.move(targetBox.x + targetBox.width, targetBox.y, { steps: 5 });
    await page.mouse.up();
  });
}

export async function moveRow(
  page: Page,
  dashboardPage: DashboardPage,
  rows: Rows,
  selectors: E2ESelectorGroups,
  sourceRow: string,
  targetRow: string
) {
  const targetBox = await getRowBox(dashboardPage, selectors, targetRow);

  // drop below the target row (relative to top left)
  await dragTo(
    page,
    `row "${sourceRow}"`,
    rows.getTitle(sourceRow).first(),
    targetBox.x,
    targetBox.y + targetBox.height
  );
}

export async function getTabBox(
  tabs: Tabs,
  tabTitle: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  const tab = tabs.getTitle(tabTitle).first();
  await expect(tab).toBeVisible();
  const boundingBox = await tab.boundingBox();
  return boundingBox!;
}

export async function checkRepeatedTabTitles(tabs: Tabs, title: string, values: Array<string | number>) {
  await test.step('Checking repeated tab titles', async () => {
    for (const value of values) {
      await expect(tabs.getTitle(`${title}${value}`)).toBeVisible();
    }
  });
}

export async function getRowBox(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  rowTitle: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  const row = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper(rowTitle)).first();
  await expect(row).toBeVisible();
  const boundingBox = await row.boundingBox();
  return boundingBox!;
}

export async function checkRepeatedRowTitles(
  rows: Rows,
  title: string,
  values: Array<string | number>,
  state: 'visible' | 'hidden' = 'visible'
) {
  await test.step(`Checking repeated row titles are ${state}`, async () => {
    for (const value of values) {
      const rowTitle = rows.getTitle(`${title}${value}`);
      if (state === 'visible') {
        await expect(rowTitle).toBeVisible();
      } else {
        await expect(rowTitle).toBeHidden();
      }
    }
  });
}

// Asserts the tab title and content are visible, and returns the content
// locator so the caller can scope further lookups to it
export async function expectVisibleTab(tabTitle: string, tabs: Tabs): Promise<Locator> {
  return test.step(`Expect tab "${tabTitle}" to be visible`, async () => {
    await expect(tabs.getTitle(tabTitle)).toBeVisible();
    const tabContent = tabs.getContent(tabTitle);
    await expect(tabContent).toBeVisible();
    return tabContent;
  });
}

// Asserts the row title and content are visible, and returns the content
// locator so the caller can scope further lookups to it
export async function expectVisibleRow(rowTitle: string, rows: Rows): Promise<Locator> {
  return test.step(`Expect row "${rowTitle}" to be visible`, async () => {
    await expect(rows.getTitle(rowTitle)).toBeVisible();
    const rowContent = rows.getContent(rowTitle);
    await expect(rowContent).toBeVisible();
    return rowContent;
  });
}

export async function fillVariableValue(page: Page, controls: Controls, varName: string, text: string) {
  await controls.variables.setValue(varName, text);
  await page.waitForLoadState('networkidle');
}
