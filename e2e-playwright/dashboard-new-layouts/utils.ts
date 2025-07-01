import { DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

const deselectPanels = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
  await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Controls).click();
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
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.variableNameInput)
      .fill(variable.name);
    if (variable.label) {
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.variableLabelInput)
        .fill(variable.label);
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
