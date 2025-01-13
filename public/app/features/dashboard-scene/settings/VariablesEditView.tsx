import { useMemo } from 'react';

import { NavModel, NavModelItem, PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneVariable, SceneVariables, sceneGraph } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { getDashboardSceneFor } from '../utils/utils';
import { createUsagesNetwork, transformUsagesToNetwork } from '../variables/utils';

import { EditListViewSceneUrlSync } from './EditListViewSceneUrlSync';
import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';
import { VariableEditorForm } from './variables/VariableEditorForm';
import { VariableEditorList } from './variables/VariableEditorList';
import { VariablesUnknownTable } from './variables/VariablesUnknownTable';
import {
  EditableVariableType,
  RESERVED_GLOBAL_VARIABLE_NAME_REGEX,
  WORD_CHARACTERS_REGEX,
  getVariableDefault,
  getVariableScene,
} from './variables/utils';

export interface VariablesEditViewState extends DashboardEditViewState {
  editIndex?: number | undefined;
}

export class VariablesEditView extends SceneObjectBase<VariablesEditViewState> implements DashboardEditView {
  public static Component = VariableEditorSettingsListView;

  public getUrlKey(): string {
    return 'variables';
  }

  protected _urlSync = new EditListViewSceneUrlSync(this);

  public getDashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getVariableSet(): SceneVariables {
    return sceneGraph.getVariables(this.getDashboard());
  }

  private getVariableIndex = (identifier: string) => {
    const variables = this.getVariables();
    return variables.findIndex((variable) => variable.state.name === identifier);
  };

  private replaceEditVariable = (newVariable: SceneVariable) => {
    // Find the index of the variable to be deleted
    const variableIndex = this.state.editIndex ?? -1;
    const { variables } = this.getVariableSet().state;
    const variable = variables[variableIndex];

    if (!variable) {
      // Handle the case where the variable is not found
      console.error('Variable not found');
      return;
    }

    const updatedVariables = [...variables.slice(0, variableIndex), newVariable, ...variables.slice(variableIndex + 1)];

    // Update the state or the variables array
    this.getVariableSet().setState({ variables: updatedVariables });
  };

  public onDelete = (identifier: string) => {
    // Find the index of the variable to be deleted
    const variableIndex = this.getVariableIndex(identifier);
    const { variables } = this.getVariableSet().state;
    if (variableIndex === -1) {
      // Handle the case where the variable is not found
      console.error('Variable not found');
      return;
    }

    // Create a new array excluding the variable to be deleted
    const updatedVariables = [...variables.slice(0, variableIndex), ...variables.slice(variableIndex + 1)];

    // Update the state or the variables array
    this.getVariableSet().setState({ variables: updatedVariables });
    // Remove editIndex otherwise switches to next variable in list
    this.setState({ editIndex: undefined });
  };

  public getVariables() {
    return this.getVariableSet().state.variables;
  }

  public onDuplicated = (identifier: string) => {
    const variableIndex = this.getVariableIndex(identifier);
    const variables = this.getVariableSet().state.variables;

    if (variableIndex === -1) {
      console.error('Variable not found');
      return;
    }

    const variableToUpdate = variables[variableIndex];
    let copyNumber = 0;
    let newName = `copy_of_${variableToUpdate.state.name}`;

    // Check if the name is unique, if not, increment the copy number
    while (variables.some((v) => v.state.name === newName)) {
      copyNumber++;
      newName = `copy_of_${variableToUpdate.state.name}_${copyNumber}`;
    }

    //clone the original variable
    const newVariable = variableToUpdate.clone(variableToUpdate.state);
    // update state name of the new variable
    newVariable.setState({ name: newName });

    const updatedVariables = [
      ...variables.slice(0, variableIndex + 1),
      newVariable,
      ...variables.slice(variableIndex + 1),
    ];

    this.getVariableSet().setState({ variables: updatedVariables });
  };

  public onOrderChanged = (fromIndex: number, toIndex: number) => {
    const variables = this.getVariableSet().state.variables;
    if (!this.getVariableSet()) {
      return;
    }
    // check the index are within the variables array
    if (fromIndex < 0 || fromIndex >= variables.length || toIndex < 0 || toIndex >= variables.length) {
      console.error('Invalid index');
      return;
    }
    const updatedVariables = [...variables];
    // Remove the variable from the array
    const movedItem = updatedVariables.splice(fromIndex, 1);
    updatedVariables.splice(toIndex, 0, movedItem[0]);
    const variablesScene = this.getVariableSet();
    variablesScene.setState({ variables: updatedVariables });
  };

  public onEdit = (identifier: string) => {
    const variableIndex = this.getVariableIndex(identifier);
    if (variableIndex === -1) {
      console.error('Variable not found');
      return;
    }
    this.setState({ editIndex: variableIndex });
  };

  public onAdd = () => {
    const variables = this.getVariables();
    const variableIndex = variables.length;
    //add the new variable to the end of the array
    const defaultNewVariable = getVariableDefault(variables);

    this.getVariableSet().setState({ variables: [...this.getVariables(), defaultNewVariable] });
    this.setState({ editIndex: variableIndex });
  };

  public onTypeChange = (type: EditableVariableType) => {
    // Find the index of the variable to be deleted
    const variableIndex = this.state.editIndex ?? -1;
    const { variables } = this.getVariableSet().state;
    const variable = variables[variableIndex];

    if (!variable) {
      // Handle the case where the variable is not found
      console.error('Variable not found');
      return;
    }

    const { name, label } = variable.state;
    const newVariable = getVariableScene(type, { name, label });
    this.replaceEditVariable(newVariable);
  };

  public onGoBack = () => {
    this.setState({ editIndex: undefined });
  };

  public onValidateVariableName = (name: string, key: string | undefined): [true, string] | [false, null] => {
    let errorText = null;
    if (!RESERVED_GLOBAL_VARIABLE_NAME_REGEX.test(name)) {
      errorText = "Template names cannot begin with '__', that's reserved for Grafana's global variables";
    }

    if (!WORD_CHARACTERS_REGEX.test(name)) {
      errorText = 'Only word characters are allowed in variable names';
    }

    const variable = this.getVariableSet().getByName(name)?.state;

    if (variable && variable.key !== key) {
      errorText = 'Variable with the same name already exists';
    }

    if (errorText) {
      return [true, errorText];
    }

    return [false, null];
  };

  public getSaveModel = () => {
    return transformSceneToSaveModel(this.getDashboard());
  };

  public getUsages = () => {
    const model = this.getSaveModel();
    const usages = createUsagesNetwork(this.getVariables(), model);
    return usages;
  };

  public getUsagesNetwork = () => {
    const usages = this.getUsages();
    const usagesNetwork = transformUsagesToNetwork(usages);
    return usagesNetwork;
  };
}

function VariableEditorSettingsListView({ model }: SceneComponentProps<VariablesEditView>) {
  const dashboard = model.getDashboard();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  // get variables from dashboard state
  const { onDelete, onDuplicated, onOrderChanged, onEdit, onTypeChange, onGoBack, onAdd } = model;
  const { variables } = model.getVariableSet().useState();
  const { editIndex } = model.useState();
  const usagesNetwork = useMemo(() => model.getUsagesNetwork(), [model]);
  const usages = useMemo(() => model.getUsages(), [model]);
  const saveModel = model.getSaveModel();

  if (editIndex !== undefined && variables[editIndex]) {
    const variable = variables[editIndex];
    if (variable) {
      return (
        <VariableEditorSettingsView
          variable={variable}
          onTypeChange={onTypeChange}
          onGoBack={onGoBack}
          pageNav={pageNav}
          navModel={navModel}
          dashboard={dashboard}
          onDelete={onDelete}
          onValidateVariableName={model.onValidateVariableName}
        />
      );
    }
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <VariableEditorList
        variables={variables}
        usages={usages}
        usagesNetwork={usagesNetwork}
        onDelete={onDelete}
        onDuplicate={onDuplicated}
        onChangeOrder={onOrderChanged}
        onAdd={onAdd}
        onEdit={onEdit}
      />
      <VariablesUnknownTable variables={variables} dashboard={saveModel} />
    </Page>
  );
}

interface VariableEditorSettingsEditViewProps {
  variable: SceneVariable;
  pageNav: NavModelItem;
  navModel: NavModel;
  dashboard: DashboardScene;
  onTypeChange: (variableType: EditableVariableType) => void;
  onGoBack: () => void;
  onDelete: (variableName: string) => void;
  onValidateVariableName: (name: string, key: string | undefined) => [true, string] | [false, null];
}

function VariableEditorSettingsView({
  variable,
  pageNav,
  navModel,
  dashboard,
  onTypeChange,
  onGoBack,
  onDelete,
  onValidateVariableName,
}: VariableEditorSettingsEditViewProps) {
  const { name } = variable.useState();

  const editVariablePageNav = {
    text: name,
    parentItem: pageNav,
  };
  return (
    <Page navModel={navModel} pageNav={editVariablePageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <VariableEditorForm
        variable={variable}
        onTypeChange={onTypeChange}
        onGoBack={onGoBack}
        onDelete={onDelete}
        onValidateVariableName={onValidateVariableName}
        // force refresh when navigating using back/forward between variables
        key={variable.state.key}
      />
    </Page>
  );
}
