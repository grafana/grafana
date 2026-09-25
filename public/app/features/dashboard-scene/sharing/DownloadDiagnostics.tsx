import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectRef, type VizPanel } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { type SceneShareTabState, type ShareView } from './types';

const DownloadDiagnosticsRenderer = lazy(() =>
  import('./ShareRenderers').then((m) => ({ default: m.DownloadDiagnosticsRenderer }))
);

function LazyDownloadDiagnosticsRenderer(props: SceneComponentProps<DownloadDiagnostics>) {
  return (
    <Suspense fallback={<Spinner />}>
      <DownloadDiagnosticsRenderer {...props} />
    </Suspense>
  );
}

export interface DownloadDiagnosticsState extends SceneShareTabState {
  // The panel this diagnostics bundle is scoped to.
  panelRef?: SceneObjectRef<VizPanel>;
  // The panel's dashboard, so its save model (and this panel's JSON within it) can be bundled.
  dashboardRef?: SceneObjectRef<DashboardScene>;
}

export class DownloadDiagnostics extends SceneObjectBase<DownloadDiagnosticsState> implements ShareView {
  static Component = LazyDownloadDiagnosticsRenderer;

  public getTabLabel() {
    return t('dashboard.diagnostics.title', 'Download diagnostics');
  }

  public getSubtitle() {
    return t(
      'dashboard.diagnostics.subtitle-panel',
      'Bundle HTTP traffic (HAR), logs, and panel JSON to help troubleshoot this panel.'
    );
  }
}
