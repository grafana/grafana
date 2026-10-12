import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectRef } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { type SceneShareTabState, type ShareView } from './types';

const DownloadDashboardDiagnosticsRenderer = lazy(() =>
  import('./ShareRenderers').then((m) => ({ default: m.DownloadDashboardDiagnosticsRenderer }))
);

function LazyDownloadDashboardDiagnosticsRenderer(props: SceneComponentProps<DownloadDashboardDiagnostics>) {
  return (
    <Suspense fallback={<Spinner />}>
      <DownloadDashboardDiagnosticsRenderer {...props} />
    </Suspense>
  );
}

export interface DownloadDashboardDiagnosticsState extends SceneShareTabState {
  dashboardRef?: SceneObjectRef<DashboardScene>;
}

export class DownloadDashboardDiagnostics
  extends SceneObjectBase<DownloadDashboardDiagnosticsState>
  implements ShareView
{
  static Component = LazyDownloadDashboardDiagnosticsRenderer;

  public getTabLabel() {
    return t('dashboard.diagnostics.title', 'Download diagnostics');
  }

  public getSubtitle() {
    return t(
      'dashboard.diagnostics.subtitle-dashboard',
      'Bundle HTTP traffic (HAR) and panel JSON for every panel in this dashboard to help troubleshoot.'
    );
  }
}
