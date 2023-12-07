import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, sceneGraph } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';
import { VariableEditorList } from './variables/VariableEditorList';
export interface VariablesEditViewState extends DashboardEditViewState {}

export class VariablesEditView extends SceneObjectBase<VariablesEditViewState> implements DashboardEditView {
  public getUrlKey(): string {
    return 'variables';
  }

  static Component = ({ model }: SceneComponentProps<VariablesEditView>) => {
    const dashboard = getDashboardSceneFor(model);
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
    // get variables from dashboard state
    const variablesObject = sceneGraph.getVariables(dashboard);
    const variables = variablesObject.useState().variables;

    const getVariableIndex = (identifier: string) => {
      return variables.findIndex((variable) => variable.state.name === identifier);
    };

    const onDelete = (identifier: string) => {
      // find the variable in the array of variables and remove it
      const fromVariableIndex = getVariableIndex(identifier);
      if (fromVariableIndex === -1) {
        return;
      }
      variables.splice(fromVariableIndex, 1);
      variablesObject.setState({ variables });
    };

    const onDuplicated = (identifier: string) => {
      return 'not implemented';
    };

    const onOrderChanged = (fromIndex: number, toIndex: number) => {
      if (!variables) {
        return;
      }
      const varEntries = variables.splice(fromIndex, 1);
      variables.splice(toIndex, 0, varEntries[0]);
    };

    const onEdit = (identifier: string) => {
      return 'not implemented';
    };

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
  };
}
