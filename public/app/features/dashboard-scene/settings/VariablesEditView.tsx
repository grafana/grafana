import React from 'react';

import { PageLayoutType, VariableModel } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneVariableSet } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { sceneVariablesSetToVariables } from '../serialization/sceneVariablesSetToVariables';
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
    const variablesSet =
      dashboard.useState().$variables ||
      new SceneVariableSet({
        variables: [],
      });

    const onDelete = (identifier: string) => {
      return 'not implemented';
    };

    const onDuplicated = (identifier: string) => {
      return 'not implemented';
    };

    const onOrderChanged = (identifier: string, fromIndex: number, toIndex: number) => {
      const variablesSetState = variablesSet?.state.variables;
      if (!variablesSetState) {
        return;
      }
      // in the array of variables change the order based on the identifier
      const getVariableIndex = (identifier: string) => {
        return variablesSetState.findIndex((variable) => variable.state.name === identifier);
      };

      const fromVariableIndex = getVariableIndex(identifier);
      const varEntries = variablesSetState.splice(fromVariableIndex, 1);
      variablesSetState.splice(toIndex, 0, varEntries[0]);

      // TODO: how do we update the state in the scenes model to the backend?
      console.log('variablesSetState', variablesSet);
    };

    const onEdit = (identifier: string) => {
      return 'not implemented';
    };

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <VariableEditorList
          variablesSet={variablesSet}
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
