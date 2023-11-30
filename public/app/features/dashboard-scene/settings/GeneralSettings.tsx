import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export interface GeneralSettingsEditViewState extends DashboardEditViewState {}

export class GeneralSettingsEditView
  extends SceneObjectBase<GeneralSettingsEditViewState>
  implements DashboardEditView
{
  public getUrlKey(): string {
    return 'settings';
  }

  static Component = ({ model }: SceneComponentProps<GeneralSettingsEditView>) => {
    const dashboard = getDashboardSceneFor(model);
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <div>General todo</div>
      </Page>
    );
  };
}
