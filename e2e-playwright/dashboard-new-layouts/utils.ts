import { Page } from '@playwright/test';

import { DashboardPage, E2ESelectorGroups, expect } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/TestV2Dashboard.json';

const deselectPanels = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
  await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Controls).click({
    position: { x: 0, y: 0 },
  });
};

export const flows = {
  deselectPanels,
  async changePanelTitle(
    dashboardPage: DashboardPage,
    selectors: E2ESelectorGroups,
    oldPanelTitle: string,
    newPanelTitle: string
  ) {
    await deselectPanels(dashboardPage, selectors);
    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
      .filter({ hasText: oldPanelTitle })
      .first()
      .click();
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
      .fill(newPanelTitle);
  },
  async changePanelDescription(
    dashboardPage: DashboardPage,
    selectors: E2ESelectorGroups,
    panelTitle: string,
    newDescription: string
  ) {
    await deselectPanels(dashboardPage, selectors);
    const panelTitleRegex = new RegExp(`^${panelTitle}$`);
    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
      .filter({ hasText: panelTitleRegex })
      .first()
      .click();
    const descriptionTextArea = dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('panel-options Description'))
      .locator('textarea');
    await descriptionTextArea.fill(newDescription);
  },
  async newEditPaneVariableClick(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.section).click();
    await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item('Variables')).click();
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.addVariableButton)
      .click();
  },
  async newEditPanelCommonVariableInputs(
    dashboardPage: DashboardPage,
    selectors: E2ESelectorGroups,
    variable: Variable
  ) {
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.variableType(variable.type))
      .click();
    const variableNameInput = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.ElementEditPane.variableNameInput
    );
    await variableNameInput.click();
    await variableNameInput.fill(variable.name);
    await variableNameInput.blur();
    if (variable.label) {
      const variableLabelInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.ElementEditPane.variableLabelInput
      );
      await variableLabelInput.click();
      await variableLabelInput.fill(variable.label);
      await variableLabelInput.blur();
    }
  },
};

export type Variable = {
  type: string;
  name: string;
  label?: string;
  description?: string;
  value: string;
};

export async function saveDashboard(dashboardPage: DashboardPage, page: Page, selectors: E2ESelectorGroups) {
  await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
  await expect(page.getByText('Dashboard saved')).toBeVisible();
}

export async function checkRepeatedPanelTitles(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  title: string,
  options: Array<string | number>
) {
  for (const option of options) {
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(`${title}${option}`))
    ).toBeVisible();
  }
}

export async function movePanel(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  sourcePanel: string | RegExp,
  targetPanel: string | RegExp
) {
  // Get target panel position
  const targetPanelElement = dashboardPage
    .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
    .filter({ hasText: targetPanel })
    .first();

  // Get source panel element
  const sourcePanelElement = dashboardPage
    .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
    .filter({ hasText: sourcePanel });

  // Perform drag and drop
  await sourcePanelElement.dragTo(targetPanelElement);
}

export async function getPanelPosition(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  panelTitle: string | RegExp
) {
  const panel = dashboardPage
    .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
    .filter({ hasText: panelTitle })
    .first();
  const boundingBox = await panel.boundingBox();
  return boundingBox;
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

export async function importTestDashboard(page: Page, selectors: E2ESelectorGroups, title: string, dashInput?: string) {
  await page.goto(selectors.pages.ImportDashboard.url);
  await page
    .getByTestId(selectors.components.DashboardImportPage.textarea)
    .fill(dashInput || JSON.stringify(testV2Dashboard));
  await page.getByTestId(selectors.components.DashboardImportPage.submit).click();
  await page.getByTestId(selectors.components.ImportDashboardForm.name).fill(title);
  await page.getByTestId(selectors.components.DataSourcePicker.inputV2).click();
  await page.locator('div[data-testid="data-source-card"]').first().click();
  await page.getByTestId(selectors.components.ImportDashboardForm.submit).click();
  const undockMenuButton = page.locator('[aria-label="Undock menu"]');
  const undockMenuVisible = await undockMenuButton.isVisible();
  if (undockMenuVisible) {
    undockMenuButton.click();
  }

  await expect(page.locator('[data-testid="uplot-main-div"]').first()).toBeVisible();
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

  page.goto(soloPanelUrl!);
}
