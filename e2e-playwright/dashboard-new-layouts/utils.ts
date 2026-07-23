import { type Page } from '@playwright/test';

import { selectors } from '@grafana/e2e-selectors';
import { Components, type DashboardPage, type E2ESelectorGroups, expect, test } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/TestV2Dashboard.json';

import { Controls, Panel, Sidebar } from './page-objects';

export const flows = {
  async addNewGenericVariable(
    page: Page,
    dashboardPage: DashboardPage,
    selectors: E2ESelectorGroups,
    variable: Variable
  ) {
    // Keep the flows signature unchanged for unmigrated callers: build the
    // `components` fixture equivalent from the page context
    const components = new Components(dashboardPage.ctx);
    const controls = new Controls({ page, dashboardPage, selectors, components });
    const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

    await controls.enterEditMode();

    await sidebar.toolbar.clickButton('Add');
    await sidebar.addOptions.clickNewVariableButton();

    await sidebar.variableOptions.selectVariableType(variable.type);

    // New variable creation schedules a delayed autofocus to name input
    // Let that timer finish before we interact to prevent focus on the wrong input
    await dashboardPage.ctx.page.waitForTimeout(250);

    await sidebar.variableOptions.setName(variable.name);
    if (variable.label) {
      await sidebar.variableOptions.setLabel(variable.label);
    }
  },
  async addNewTextBoxVariable(
    page: Page,
    dashboardPage: DashboardPage,
    selectors: E2ESelectorGroups,
    variable: Variable
  ) {
    await flows.addNewGenericVariable(page, dashboardPage, selectors, variable);

    const components = new Components(dashboardPage.ctx);
    const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

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

export async function saveDashboard(
  dashboardPage: DashboardPage,
  page: Page,
  selectors: E2ESelectorGroups,
  title?: string
) {
  // Keep the flows signature unchanged for unmigrated callers: build the
  // `components` fixture equivalent from the page context
  const components = new Components(dashboardPage.ctx);
  const controls = new Controls({ page, dashboardPage, selectors, components });

  await controls.saveDashboard(title);

  // wait for the toast
  const toast = page.getByRole('status', { name: 'Dashboard saved' });
  await expect(toast).toBeVisible();
  // close toast, we do this to prevent any incorrect assertion when several saves occur fast. i.e. the 1st toast is still visible but the 2nd save has not occurred yet
  await toast.getByRole('button', { name: 'Close alert' }).click();
}

export async function checkRepeatedPanelTitles(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  title: string,
  options: Array<string | number>,
  expectHidden = false
) {
  for (const option of options) {
    const titleLocator = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title(`${title}${option}`)
    );
    if (expectHidden) {
      await expect(titleLocator).toBeHidden();
    } else {
      await expect(titleLocator).toBeVisible();
    }
  }
}

export async function movePanel(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  sourcePanel: string | RegExp,
  targetPanel: string | RegExp
) {
  // Keep the signature unchanged for unmigrated callers: build the
  // `components` fixture equivalent from the page context
  const components = new Components(dashboardPage.ctx);
  const panel = new Panel({ page: dashboardPage.ctx.page, dashboardPage, selectors, components });

  await test.step(`Move panel "${sourcePanel}" onto "${targetPanel}"`, async () => {
    // Perform drag and drop; pixel-sensitive mechanics stay out of page objects
    await panel.getHeaderByTitle(sourcePanel).dragTo(panel.getHeaderByTitle(targetPanel));
  });
}

export async function getPanelPosition(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  panelTitle: string | RegExp
) {
  // Keep the signature unchanged for unmigrated callers: build the
  // `components` fixture equivalent from the page context
  const components = new Components(dashboardPage.ctx);
  const panel = new Panel({ page: dashboardPage.ctx.page, dashboardPage, selectors, components });

  // boundingBox() is a point-in-time snapshot and stays out of page objects
  return panel.getHeaderByTitle(panelTitle).boundingBox();
}

export async function verifyChanges(
  dashboardPage: DashboardPage,
  page: Page,
  selectors: E2ESelectorGroups,
  changeText: string
) {
  await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Changes')).click();
  await expect(page.getByText('Full JSON diff').locator('..')).toContainText(changeText);
  await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.General.close).click();
}
interface ImportTestDashboardOptions {
  checkPanelsVisible?: boolean;
  requiresDataSourceSelection?: boolean;
}

export function stripMetadataNameFromImportJson(input: string): string {
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
) {
  options = { checkPanelsVisible: true, requiresDataSourceSelection: true, ...options };
  const importJson = stripMetadataNameFromImportJson(dashInput || JSON.stringify(testV2Dashboard));
  await page.goto(selectors.pages.ImportDashboard.url);
  await page.getByTestId(selectors.components.DashboardImportPage.textarea).fill(importJson);
  await page.getByTestId(selectors.components.DashboardImportPage.submit).click();
  await page.getByTestId(selectors.components.ImportDashboardForm.name).fill(title);
  if (options.requiresDataSourceSelection) {
    await page.getByTestId(selectors.components.DataSourcePicker.inputV2).click();
    await page.locator('div[data-testid="data-source-card"]').first().click();
  }
  await page.getByTestId(selectors.components.ImportDashboardForm.submit).click();
  const undockMenuButton = page.locator('[aria-label="Undock menu"]');
  const undockMenuVisible = await undockMenuButton.isVisible();
  if (undockMenuVisible) {
    undockMenuButton.click();
  }
  if (options.checkPanelsVisible) {
    await expect(page.locator('[data-testid="uplot-main-div"]').first()).toBeVisible();
  }
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

export async function goToPanelSnapshot(page: Page) {
  // extracting snapshot url from clipboard
  const snapshotUrl = await page.evaluate(() => navigator.clipboard.readText());

  expect(snapshotUrl).toBeDefined();

  await page.goto(snapshotUrl);
}

export async function moveTab(
  dashboardPage: DashboardPage,
  page: Page,
  selectors: E2ESelectorGroups,
  sourceTab: string,
  targetTab: string
) {
  // Get target panel position
  const targetTabElement = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(targetTab)).first();

  // Get source panel element
  const sourceTabElement = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(sourceTab)).first();

  const targetBox = await targetTabElement.boundingBox();

  // Perform drag and drop (dragTo() did not work in this case)
  await sourceTabElement.hover();
  await page.mouse.down();
  // move to adjusted target position (relative to top left)
  await page.mouse.move((targetBox?.x || 0) + (targetBox?.width || 0), targetBox?.y || 0, { steps: 5 });
  await page.mouse.up();
}

export async function moveRow(
  dashboardPage: DashboardPage,
  page: Page,
  selectors: E2ESelectorGroups,
  sourceRow: string,
  targetRow: string
) {
  const targetRowElement = dashboardPage
    .getByGrafanaSelector(selectors.components.DashboardRow.wrapper(targetRow))
    .first();

  const sourceRowElement = dashboardPage
    .getByGrafanaSelector(selectors.components.DashboardRow.title(sourceRow))
    .first();

  const targetBox = await targetRowElement.boundingBox();

  // Perform drag and drop (dragTo() did not work in this case)
  await sourceRowElement.hover();
  await page.mouse.down();
  // move to adjusted target position (relative to top left)
  await page.mouse.move(targetBox?.x || 0, (targetBox?.y || 0) + (targetBox?.height || 0), { steps: 5 });
  await page.mouse.up();
}

export async function groupIntoTab(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.groupPanels).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addTab).click();
}

export async function groupIntoRow(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.groupPanels).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow).click();
}

export async function checkRepeatedTabTitles(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  title: string,
  options: Array<string | number>
) {
  for (const option of options) {
    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`${title}${option}`))).toBeVisible();
  }
}

export async function getTabPosition(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, tabTitle: string) {
  const tab = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(tabTitle)).first();
  const boundingBox = await tab.boundingBox();
  return boundingBox;
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
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  title: string,
  options: Array<string | number>
) {
  for (const option of options) {
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${title}${option}`))
    ).toBeVisible();
  }
}

export async function switchToAutoGrid(page: Page, dashboardPage: DashboardPage) {
  await page.getByLabel('layout-selection-option-Auto').click();
  // confirm layout change if applicable
  const confirmModal = dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete);
  if (confirmModal) {
    await confirmModal.click();
  }
}

export async function selectRow(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, rowTitle: string) {
  return dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(rowTitle)).click();
}
export async function toggleRow(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, rowTitle: string) {
  return dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.toggle(rowTitle)).click();
}

export function getPanelByTitle(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, panelTitle: string) {
  return dashboardPage
    .getByGrafanaSelector(selectors.components.Panels.Panel.title(panelTitle))
    .getByTestId(selectors.components.Panels.Panel.headerContainer);
}

export function getRowByTitle(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, rowTitle: string) {
  return dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(rowTitle)).first();
}

export function getRowWrapper(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, rowTitle: string) {
  return dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper(rowTitle)).first();
}

export async function addNewPanelFromSidebar(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.addButton).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton).click();
}

export async function fillVariableValue(
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  varName: string,
  text: string
) {
  const variable = dashboardPage
    .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels(varName))
    .locator('..')
    .locator('input');
  await variable.click();
  await variable.clear();
  await variable.fill(text);
  await variable.press('Enter');
  await page.waitForLoadState('networkidle');
}
