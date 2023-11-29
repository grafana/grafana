import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { GeneralSettingsEditView } from './GeneralSettings';
import { DashboardEditView, useDashboardEditPageNav } from './utils';

export interface VariablesEditViewState extends SceneObjectState {}

export class VariablesEditView extends SceneObjectBase<VariablesEditViewState> implements DashboardEditView {
  public getUrlKey(): string {
    return 'variables';
  }

  static Component = ({ model }: SceneComponentProps<GeneralSettingsEditView>) => {
    const dashboard = getDashboardSceneFor(model);
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <div>variables todo</div>
      </Page>
    );
  };
}
