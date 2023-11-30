import React from 'react';

import { PageLayoutType, VariableModel } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneVariableSet } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { sceneVariablesSetToVariables } from '../serialization/sceneVariablesSetToVariables';
import { getDashboardSceneFor } from '../utils/utils';

import { GeneralSettingsEditView } from './GeneralSettings';
import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';
import { VariableEditorList } from './variables/VariableEditorList';
export interface VariablesEditViewState extends DashboardEditViewState {}

export class VariablesEditView extends SceneObjectBase<VariablesEditViewState> implements DashboardEditView {
  public getUrlKey(): string {
    return 'variables';
  }

  static Component = ({ model }: SceneComponentProps<GeneralSettingsEditView>) => {
    const dashboard = getDashboardSceneFor(model);
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
    // get variables from dashboard state

    const variablesSet = dashboard.useState().$variables;
    let variables: VariableModel[] = [];

    if (variablesSet instanceof SceneVariableSet) {
      variables = sceneVariablesSetToVariables(variablesSet);
    }

    console.log('Variables scenes', variables);
    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <VariableEditorList variables={variables} variablesSet={variablesSet} />
        <div>variables todo</div>
      </Page>
    );
  };
}
