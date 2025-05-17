import { e2e } from '../utils';

// Common flows for adding/editing variables on the new edit pane
export const flows = {
  newEditPaneVariableClick() {
    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();
    e2e.components.PanelEditor.Outline.section().should('be.visible').click();
    e2e.components.PanelEditor.Outline.item('Variables').should('be.visible').click();
    e2e.components.PanelEditor.ElementEditPane.addVariableButton().should('be.visible').click();
  },
  newEditPanelCommonVariableInputs(variable: Variable) {
    e2e.components.PanelEditor.ElementEditPane.variableType(variable.type).should('be.visible').click();
    e2e.components.PanelEditor.ElementEditPane.variableNameInput().clear().type(variable.name).blur();
    e2e.components.PanelEditor.ElementEditPane.variableLabelInput().clear().type(variable.label).blur();
  },
};

export type Variable = {
  type: string;
  name: string;
  label?: string;
  description?: string;
  value: string;
};
