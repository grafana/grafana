import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, useDashboardEditPageNav } from './DashboardEditView';

export interface GeneralSettingsState extends SceneObjectState {}

export class GeneralSettings extends SceneObjectBase<GeneralSettingsState> implements DashboardEditView {
  public getUrlKey(): string {
    return 'settings';
  }

  static Component = ({ model }: SceneComponentProps<GeneralSettings>) => {
    const dashboard = getDashboardSceneFor(model);
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <div>General todo</div>
      </Page>
    );
  };
}
