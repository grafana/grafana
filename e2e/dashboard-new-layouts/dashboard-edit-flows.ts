import { e2e } from '../utils';

const deselectPanels = () => {
  e2e.pages.Dashboard.Controls().click();
};

// Common flows for adding/editing variables on the new edit pane
export const flows = {
  newEditPaneVariableClick() {
    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();
    e2e.components.PanelEditor.Outline.section().should('be.visible').click();
    e2e.components.PanelEditor.Outline.item('Variables').should('be.visible').click();
    e2e.components.PanelEditor.ElementEditPane.addVariableButton().should('be.visible').click();
  },
  newEditPanelCommonVariableInputs(variable: Variable) {
    e2e.components.PanelEditor.ElementEditPane.variableType(variable.type)
      .scrollIntoView()
      .should('be.visible')
      .click();
    e2e.components.PanelEditor.ElementEditPane.variableNameInput().clear().type(variable.name).blur();
    e2e.components.PanelEditor.ElementEditPane.variableLabelInput().clear().type(variable.label).blur();
  },
  firstPanelTitleShouldBe(panelTitle: string) {
    return e2e.components.Panels.Panel.headerContainer()
      .first()
      .within(() => cy.get('h2').first().should('have.text', panelTitle));
  },
  deselectPanels,
  changePanelTitle(oldPanelTitle: string, newPanelTitle: string) {
    deselectPanels();
    const oldPanelRegex = new RegExp(`^${oldPanelTitle}$`);
    e2e.flows.scenes.selectPanel(oldPanelRegex);

    e2e.components.PanelEditor.OptionsPane.fieldInput('Title')
      .should('have.value', oldPanelTitle)
      .clear()
      .type(newPanelTitle);
    e2e.components.PanelEditor.OptionsPane.fieldInput('Title').should('have.value', newPanelTitle);
  },
  changePanelDescription(panelTitle: string, newDescription: string) {
    deselectPanels();
    const panelTitleRegex = new RegExp(`^${panelTitle}$`);
    e2e.flows.scenes.selectPanel(panelTitleRegex);

    e2e.components.PanelEditor.OptionsPane.fieldLabel('panel-options Description').within(() => {
      cy.get('textarea').type(newDescription);
      cy.get('textarea').should('have.value', newDescription);
    });
  },
};

export type Variable = {
  type: string;
  name: string;
  label?: string;
  description?: string;
  value: string;
};
