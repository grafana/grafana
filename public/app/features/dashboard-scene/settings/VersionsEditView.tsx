import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export interface VersionsEditViewState extends DashboardEditViewState {}

export class VersionsEditView extends SceneObjectBase<VersionsEditViewState> implements DashboardEditView {
  public static Component = VersionsEditorSettingsListView;

  public getUrlKey(): string {
    return 'versions';
  }

  public getDashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }
}

function VersionsEditorSettingsListView({ model }: SceneComponentProps<VersionsEditView>) {
  const dashboard = model.getDashboard();

  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <div>TODO</div>
    </Page>
  );
}
