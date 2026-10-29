import { lazy, Suspense } from 'react';

import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneFor } from '../utils/utils';

import { type DashboardEditView, type DashboardEditViewState } from './utils';

const PermissionsEditViewRenderer = lazy(() =>
  import('./SettingsRenderers').then((m) => ({ default: m.PermissionsEditViewRenderer }))
);

function LazyPermissionsEditViewRenderer(props: SceneComponentProps<PermissionsEditView>) {
  return (
    <Suspense fallback={<Spinner />}>
      <PermissionsEditViewRenderer {...props} />
    </Suspense>
  );
}

interface PermissionsEditViewState extends DashboardEditViewState {}

export class PermissionsEditView extends SceneObjectBase<PermissionsEditViewState> implements DashboardEditView {
  public static Component = LazyPermissionsEditViewRenderer;

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'permissions';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }
}
