import { DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

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
