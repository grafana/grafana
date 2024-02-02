import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Permissions } from 'app/core/components/AccessControl';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

interface PermissionsEditViewState extends DashboardEditViewState {}

export class PermissionsEditView extends SceneObjectBase<PermissionsEditViewState> implements DashboardEditView {
  public static Component = PermissionsEditorSettings;

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'permissions';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public getDashboardUid(): string {
    if (this._dashboard.state.uid === undefined) {
      throw new Error('Dashboard uid is undefined');
    }

    return this._dashboard.state.uid;
  }
}

function PermissionsEditorSettings({ model }: SceneComponentProps<PermissionsEditView>) {
  const dashboard = model.getDashboard();
  const dashboardUid = model.getDashboardUid();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsWrite);

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <Permissions resource={'dashboards'} resourceId={dashboardUid} canSetPermissions={canSetPermissions} />
    </Page>
  );
}
