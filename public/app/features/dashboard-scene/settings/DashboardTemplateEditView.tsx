import { lazy, Suspense } from 'react';

import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneFor } from '../utils/utils';

import { type DashboardEditView, type DashboardEditViewState } from './utils';

const DashboardTemplateEditViewRenderer = lazy(() =>
  import('./SettingsRenderers').then((m) => ({ default: m.DashboardTemplateEditViewRenderer }))
);

function LazyDashboardTemplateEditViewRenderer(props: SceneComponentProps<DashboardTemplateEditView>) {
  return (
    <Suspense fallback={<Spinner />}>
      <DashboardTemplateEditViewRenderer {...props} />
    </Suspense>
  );
}

export interface DashboardTemplateEditViewState extends DashboardEditViewState {}

export class DashboardTemplateEditView
  extends SceneObjectBase<DashboardTemplateEditViewState>
  implements DashboardEditView
{
  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'template';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  static Component = LazyDashboardTemplateEditViewRenderer;
}
