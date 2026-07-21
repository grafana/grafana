import { useEffect, useRef, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { sceneGraph, type SceneComponentProps, SceneObjectBase, type SceneObjectRef, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import {
  type DashboardDiagnosticsPanel,
  downloadDashboardDiagnostics,
  getDashboardDiagnosticsStatus,
  startDashboardDiagnostics,
} from 'app/features/query/diagnostics/downloadDiagnostics';

import { type DashboardScene } from '../scene/DashboardScene';

import { DiagnosticsDrawerContent } from './DiagnosticsDrawerContent';
import { getQueryRunnerFor } from './diagnosticsUtils';
import { type SceneShareTabState, type ShareView } from './types';

// How long to wait between status polls, and the cap on attempts (~5 min, matching the backend's
// generation timeout) before giving up client-side.
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 300;

export interface DownloadDashboardDiagnosticsState extends SceneShareTabState {
  dashboardRef?: SceneObjectRef<DashboardScene>;
}

export class DownloadDashboardDiagnostics
  extends SceneObjectBase<DownloadDashboardDiagnosticsState>
  implements ShareView
{
  static Component = DownloadDashboardDiagnosticsRenderer;

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

// panel.state.key is "panel-<id>"; parse the numeric id without importing utils for the same
// import-cycle reason documented in diagnosticsUtils.
// Mirrors getPanelIdForVizPanel in dashboard-scene/utils/utils.ts, including its non-null assertion:
// every VizPanel in the scene graph is keyed this way, so an undefined key indicates a real bug
// upstream rather than something to paper over with a fallback id.
function panelIdFrom(panel: VizPanel): number {
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}

// Collects every data panel's queries (with the runner-level datasource filled in and hidden queries
// dropped, mirroring the single-panel view) into the whole-dashboard request payload. Panels with no
// active queries (e.g. text panels) are omitted.
function collectDashboardPanels(dashboard: DashboardScene): DashboardDiagnosticsPanel[] {
  const vizPanels = sceneGraph.findAllObjects(dashboard, (o) => o instanceof VizPanel);
  const panels: DashboardDiagnosticsPanel[] = [];

  for (const obj of vizPanels) {
    const panel = obj instanceof VizPanel ? obj : undefined;
    if (!panel) {
      continue;
    }
    const runner = getQueryRunnerFor(panel);
    const runnerDatasource = runner?.state.datasource;
    const queries: DataQuery[] = (runner?.state.queries ?? [])
      .map((query) => (query.datasource ? query : { ...query, datasource: runnerDatasource }))
      .filter((query) => !query.hide);
    if (queries.length === 0) {
      continue;
    }
    const timeRange = sceneGraph.getTimeRange(panel).state.value;
    // Repeat-by-variable clones share their source panel's key (e.g. `panel-3-clone-1` and
    // `panel-3-clone-2` both parse to id 3 in panelIdFrom), so multiple entries below can carry the
    // same id -- that's intentional. dashboard.getSaveModel(), sent alongside this list in
    // startDashboardDiagnostics, only serializes the source panel once (clones aren't separate
    // save-model elements), so the id has to match that source panel for the backend to resolve its
    // panel JSON. Each clone still gets its own array entry, so its captured queries aren't lost.
    panels.push({
      id: panelIdFrom(panel),
      title: panel.state.title ?? '',
      from: String(timeRange.from.valueOf()),
      to: String(timeRange.to.valueOf()),
      queries,
    });
  }

  return panels;
}

const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true }
    );
  });

function DownloadDashboardDiagnosticsRenderer({ model }: SceneComponentProps<DownloadDashboardDiagnostics>) {
  const { onDismiss, dashboardRef } = model.useState();
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Abort any in-flight request if the drawer unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const [{ loading: isGenerating, error }, onDownload] = useAsyncFn(
    async (includeLogs: boolean) => {
      const dashboard = dashboardRef?.resolve();
      if (!dashboard) {
        return;
      }
      const panels = collectDashboardPanels(dashboard);
      // Known limitation (follow-up): template variables are sent un-interpolated, so captured traffic
      // won't match panels that use $vars until per-datasource interpolation is applied.
      if (panels.length === 0) {
        throw new Error(t('dashboard.diagnostics.no-panels', 'This dashboard has no panels with active queries.'));
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ done: 0, total: panels.length });

      const uid = await startDashboardDiagnostics(panels, dashboard.getSaveModel(), {
        includeLogs,
        signal: controller.signal,
      });

      for (let attempt = 0; ; attempt++) {
        const status = await getDashboardDiagnosticsStatus(uid, controller.signal);
        setProgress({ done: status.panelsDone, total: status.panelsTotal });
        if (status.state === 'complete') {
          break;
        }
        if (status.state === 'error') {
          throw new Error(
            status.error || t('dashboard.diagnostics.generation-failed', 'Diagnostics generation failed')
          );
        }
        if (attempt >= MAX_POLL_ATTEMPTS) {
          throw new Error(t('dashboard.diagnostics.timed-out', 'Timed out waiting for diagnostics generation'));
        }
        await delay(POLL_INTERVAL_MS, controller.signal);
      }

      await downloadDashboardDiagnostics(uid, controller.signal);
    },
    [dashboardRef]
  );

  const handleDismiss = () => {
    abortRef.current?.abort();
    onDismiss?.();
  };

  return (
    <DiagnosticsDrawerContent
      description={
        <Trans i18nKey="dashboard.diagnostics.info-text-dashboard">
          Generates a diagnostic bundle for the whole dashboard by re-running every panel&apos;s queries with HTTP
          capture active. This runs in the background and may take a while for large dashboards.
        </Trans>
      }
      progress={
        isGenerating && progress ? (
          <Trans i18nKey="dashboard.diagnostics.progress" values={{ done: progress.done, total: progress.total }}>
            Capturing panel {'{{done}}'} of {'{{total}}'}…
          </Trans>
        ) : undefined
      }
      error={error}
      isGenerating={isGenerating}
      onDownload={onDownload}
      onDismiss={handleDismiss}
    />
  );
}
