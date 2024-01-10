import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneVariables, sceneGraph } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';
import { VariableEditorList } from './variables/VariableEditorList';
export interface VariablesEditViewState extends DashboardEditViewState {}

export class VariablesEditView extends SceneObjectBase<VariablesEditViewState> implements DashboardEditView {
  public static Component = VariableEditorSettingsListView;

  public getUrlKey(): string {
    return 'variables';
  }

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

    const originalVariable = variables[variableIndex];
    let copyNumber = 0;
    let newName = `copy_of_${originalVariable.state.name}`;

    // Check if the name is unique, if not, increment the copy number
    while (variables.some((v) => v.state.name === newName)) {
      copyNumber++;
      newName = `copy_of_${originalVariable.state.name}_${copyNumber}`;
    }

    //clone the original variable

    const newVariable = originalVariable.clone(originalVariable.state);
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
    return 'not implemented';
  };
}

function VariableEditorSettingsListView({ model }: SceneComponentProps<VariablesEditView>) {
  const dashboard = model.getDashboard();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  // get variables from dashboard state
  const { onDelete, onDuplicated, onOrderChanged, onEdit } = model;
  const { variables } = model.getVariableSet().useState();

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <VariableEditorList
        variables={variables}
        onDelete={onDelete}
        onDuplicate={onDuplicated}
        onChangeOrder={onOrderChanged}
        onAdd={() => {}}
        onEdit={onEdit}
      />
    </Page>
  );
}
