import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { LoadingState, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { isFetchError, logError } from '@grafana/runtime';
import {
  sceneGraph,
  type SceneComponentProps,
  SceneDataTransformer,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneDataProvider,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { capturePanelScreenshot } from 'app/features/query/diagnostics/capturePanelScreenshot';
import {
  type DashboardDiagnosticsPanel,
  downloadDashboardDiagnostics,
  getDashboardDiagnosticsStatus,
  startDashboardDiagnostics,
} from 'app/features/query/diagnostics/downloadDiagnostics';
import { interpolateDiagnosticsQueries } from 'app/features/query/diagnostics/interpolateQueries';

import { type DashboardScene } from '../scene/DashboardScene';

import { type SceneShareTabState, type ShareView } from './types';

// How long to wait between status polls, and the cap on attempts (~5 min, matching the backend's
// generation timeout) before giving up client-side.
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 300;

// How long to wait for one panel's data before capturing it anyway. Bounded
// so a single panel whose query never settles cannot hold up the whole bundle.
const PANEL_DATA_TIMEOUT_MS = 15_000;

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
      'Bundle HTTP traffic (HAR), panel JSON, and a screenshot for every panel in this dashboard to help troubleshoot.'
    );
  }
}

// Inlined rather than imported from dashboard-scene/utils/utils: that module transitively reaches
// DashboardScene, which imports ShareDrawer (which imports this view), creating an import cycle.
function getQueryRunnerFor(sceneObject: SceneObject | undefined): SceneQueryRunner | undefined {
  if (!sceneObject) {
    return undefined;
  }
  const dataProvider = sceneObject.state.$data ?? sceneObject.parent?.state.$data;
  if (dataProvider instanceof SceneQueryRunner) {
    return dataProvider;
  }
  if (dataProvider instanceof SceneDataTransformer) {
    return getQueryRunnerFor(dataProvider);
  }
  return undefined;
}

// Reported through logError rather than surfaced in the UI or written to the console: on a whole-dashboard
// run an individual panel can legitimately fail to capture, so an alert per miss would be noise, and the
// manifest records each reason anyway.
const SCREENSHOT_FAILURE_MESSAGE = 'Download diagnostics: failed to capture panel screenshot for';

// panel.state.key is "panel-<id>"; parse the numeric id without importing utils (import cycle, as above).
// Mirrors getPanelIdForVizPanel in dashboard-scene/utils/utils.ts, including its non-null assertion:
// every VizPanel in the scene graph is keyed this way, so an undefined key indicates a real bug
// upstream rather than something to paper over with a fallback id.
function panelIdFrom(panel: VizPanel): number {
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}

// Collects every data panel's queries (with the runner-level datasource filled in, hidden queries
// dropped, and template/scoped variables interpolated, mirroring the single-panel view) into the
// whole-dashboard request payload. Panels with no active queries (e.g. text panels) are omitted.
async function collectDashboardPanels(dashboard: DashboardScene): Promise<DashboardDiagnosticsPanel[]> {
  const vizPanels = sceneGraph.findAllObjects(dashboard, (o) => o instanceof VizPanel);

  // Resolve every panel in parallel: each panel's interpolation makes its own datasource round
  // trips, so serializing them would scale latency with the panel count on large dashboards.
  // Promise.all preserves scene-graph order, and null entries (non-VizPanels, panels with no active
  // queries such as text panels) are dropped afterwards.
  const collected = await Promise.all(
    vizPanels.map(async (obj): Promise<{ panel: VizPanel; entry: DashboardDiagnosticsPanel } | null> => {
      const panel = obj instanceof VizPanel ? obj : undefined;
      if (!panel) {
        return null;
      }
      const runner = getQueryRunnerFor(panel);
      const runnerDatasource = runner?.state.datasource;
      const rawQueries: DataQuery[] = (runner?.state.queries ?? [])
        .map((query) => (query.datasource ? query : { ...query, datasource: runnerDatasource }))
        .filter((query) => !query.hide);
      if (rawQueries.length === 0) {
        return null;
      }
      // Interpolate so each captured panel matches what it ran; scopedVars carries this panel so a
      // repeated panel's clone-local variable value resolves from its position in the scene graph.
      const queries = await interpolateDiagnosticsQueries(
        rawQueries,
        { __sceneObject: { value: panel } },
        runner?.state.data?.request?.filters
      );
      const timeRange = sceneGraph.getTimeRange(panel).state.value;
      // Repeat-by-variable clones share their source panel's key (e.g. `panel-3-clone-1` and
      // `panel-3-clone-2` both parse to id 3 in panelIdFrom), so multiple entries below can carry the
      // same id -- that's intentional. dashboard.getSaveModel(), sent alongside this list in
      // startDashboardDiagnostics, only serializes the source panel once (clones aren't separate
      // save-model elements), so the id has to match that source panel for the backend to resolve its
      // panel JSON. Each clone still gets its own array entry, so its captured queries aren't lost.
      return {
        panel,
        entry: {
          id: panelIdFrom(panel),
          title: panel.state.title ?? '',
          from: String(timeRange.from.valueOf()),
          to: String(timeRange.to.valueOf()),
          queries,
        },
      };
    })
  );

  const resolved = collected.filter((c): c is { panel: VizPanel; entry: DashboardDiagnosticsPanel } => c !== null);
  await attachPanelScreenshots(resolved);
  return resolved.map((c) => c.entry);
}

/**
 * Captures every panel and attaches the PNG to its request entry.
 *
 * The problem this solves: on a dashboard taller than the viewport, most panels have never run their
 * queries. Scenes wraps each panel in `LazyLoader` with `mode="query"`, which mounts the panel's DOM
 * immediately but forwards viewport intersection to its query runner; `SceneQueryRunner.runWithTimeRange`
 * then skips the query outright while the panel is out of view. Capturing as-is would yield an empty
 * "No data" image for every panel below the fold -- worse than no image, because it is indistinguishable
 * from the empty-panel bug the bundle usually exists to diagnose.
 *
 * So each panel's query runner is told to ignore the viewport (`bypassIsInViewChanged`, the same lever
 * the dashboard datasource uses to read an off-screen source panel), its data is awaited, and only then
 * is it captured. An off-screen panel paints normally once it has data -- it is in the layout, merely
 * scrolled past -- so nothing has to be scrolled into view and the user's scroll position is untouched.
 *
 * Bypass is enabled for every panel up front so their queries run concurrently, then captures are taken
 * one at a time: capture is main-thread work (the renderer walks every stylesheet in the document), so
 * running them in parallel would not make it faster.
 */
async function attachPanelScreenshots(items: Array<{ panel: VizPanel; entry: DashboardDiagnosticsPanel }>) {
  const providers = items.map(({ panel }) => getDataProviderFor(panel));
  providers.forEach((provider) => provider?.bypassIsInViewChanged?.(true));

  try {
    for (const [index, { panel, entry }] of items.entries()) {
      const onError = (error: Error) =>
        logError(error, { context: SCREENSHOT_FAILURE_MESSAGE, panelKey: panel.state.key ?? '' });
      try {
        await waitForPanelData(providers[index]);
      } catch (error) {
        // A panel whose data never settles is still worth capturing -- whatever it shows (a spinner, an
        // error, "No data") is what the user would see, and the reason is reported either way.
        onError(error instanceof Error ? error : new Error(String(error)));
      }
      // requireInViewport is off here precisely because the wait above removed the reason for it.
      entry.screenshot = await capturePanelScreenshot(panel.getPathId(), onError, { requireInViewport: false });
    }
  } finally {
    // Always hand the viewport back to the query runners, even if a capture threw: leaving bypass on
    // would keep off-screen panels refreshing for the rest of the session.
    providers.forEach((provider) => provider?.bypassIsInViewChanged?.(false));
  }
}

/** The panel's data provider (a query runner, or the transformer wrapping one). Repeat clones share the
 * provider with their parent, hence the parent fallback -- same lookup the drawers already use. */
function getDataProviderFor(panel: VizPanel): SceneDataProvider | undefined {
  return panel.state.$data ?? panel.parent?.state.$data;
}

function hasSettled(provider: SceneDataProvider): boolean {
  const state = provider.state.data?.state;
  return state === LoadingState.Done || state === LoadingState.Error;
}

/**
 * Waits for the provider to reach a terminal state, bounded so one stuck panel can't hold the bundle.
 *
 * Returns immediately when there is nothing to wait for: no provider, an **inactive** one, or data that
 * has already settled. The inactive check is the important one -- an inactive provider never runs its
 * queries, so waiting on it would burn the full timeout per panel for a result that is never coming.
 *
 * Event-driven rather than polled, so a result that arrives early is not waited out.
 */
function waitForPanelData(provider: SceneDataProvider | undefined): Promise<void> {
  if (!provider || !provider.isActive || hasSettled(provider)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      subscription.unsubscribe();
      settle();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error(`panel data did not settle within ${PANEL_DATA_TIMEOUT_MS}ms`))),
      PANEL_DATA_TIMEOUT_MS
    );
    const subscription = provider.subscribeToState(() => {
      if (hasSettled(provider)) {
        finish(resolve);
      }
    });
  });
}

// The download uses blob/json fetches whose FetchError carries the detail in status/statusText, so
// build the message from those rather than error.message (which would leave the alert body empty).
function diagnosticsErrorMessage(error: Error): string {
  if (isFetchError(error)) {
    const parts = [error.status, error.statusText].filter(Boolean);
    return parts.length ? parts.join(' ') : t('dashboard.diagnostics.request-failed', 'Request failed');
  }
  return error.message || t('dashboard.diagnostics.error-title', 'Failed to generate diagnostics');
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
  const styles = useStyles2(getStyles);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Abort any in-flight request if the drawer unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const [{ loading: isGenerating, error }, onDownload] = useAsyncFn(async () => {
    const dashboard = dashboardRef?.resolve();
    if (!dashboard) {
      return;
    }
    // Create the controller before collecting panels: interpolation awaits datasource round trips,
    // so a cancel or drawer unmount during that phase must abort here rather than no-op against a
    // null ref and let backend generation start after the UI is gone.
    const controller = new AbortController();
    abortRef.current = controller;

    const panels = await collectDashboardPanels(dashboard);
    if (controller.signal.aborted) {
      return;
    }
    if (panels.length === 0) {
      throw new Error(t('dashboard.diagnostics.no-panels', 'This dashboard has no panels with active queries.'));
    }

    setProgress({ done: 0, total: panels.length });

    const uid = await startDashboardDiagnostics(panels, dashboard.getSaveModel(), controller.signal);

    for (let attempt = 0; ; attempt++) {
      const status = await getDashboardDiagnosticsStatus(uid, controller.signal);
      setProgress({ done: status.panelsDone, total: status.panelsTotal });
      if (status.state === 'complete') {
        break;
      }
      if (status.state === 'error') {
        throw new Error(status.error || t('dashboard.diagnostics.generation-failed', 'Diagnostics generation failed'));
      }
      if (attempt >= MAX_POLL_ATTEMPTS) {
        throw new Error(t('dashboard.diagnostics.timed-out', 'Timed out waiting for diagnostics generation'));
      }
      await delay(POLL_INTERVAL_MS, controller.signal);
    }

    await downloadDashboardDiagnostics(uid, controller.signal);
  }, [dashboardRef]);

  const handleDismiss = () => {
    abortRef.current?.abort();
    onDismiss?.();
  };

  return (
    <div>
      <p className={styles.info}>
        <Trans i18nKey="dashboard.diagnostics.info-text-dashboard">
          Generates a diagnostic bundle for the whole dashboard by re-running every panel&apos;s queries with HTTP
          capture active. This runs in the background and may take a while for large dashboards.
        </Trans>
      </p>

      <Alert
        severity="warning"
        title={t('dashboard.diagnostics.sensitive-warning-title', 'May contain sensitive data')}
      >
        <Trans i18nKey="dashboard.diagnostics.sensitive-warning-body">
          The bundle can include request headers, query parameters, server log lines, and images of the panels as
          currently displayed. Review it before sharing outside your organization.
        </Trans>
      </Alert>

      {isGenerating && progress && (
        <p className={styles.info}>
          <Trans i18nKey="dashboard.diagnostics.progress" values={{ done: progress.done, total: progress.total }}>
            Capturing panel {'{{done}}'} of {'{{total}}'}…
          </Trans>
        </p>
      )}

      {error && (
        <Alert severity="error" title={t('dashboard.diagnostics.error-title', 'Failed to generate diagnostics')}>
          {diagnosticsErrorMessage(error)}
        </Alert>
      )}

      <div
        className={styles.buttonRow}
        role="group"
        aria-label={t('dashboard.diagnostics.actions', 'Diagnostics actions')}
      >
        <Button variant="primary" onClick={onDownload} disabled={isGenerating} icon="download-alt">
          {isGenerating ? (
            <Trans i18nKey="dashboard.diagnostics.generating-button">Generating…</Trans>
          ) : (
            <Trans i18nKey="dashboard.diagnostics.download-button">Download diagnostics</Trans>
          )}
        </Button>
        <Button variant="secondary" onClick={handleDismiss} fill="outline">
          <Trans i18nKey="dashboard.diagnostics.cancel-button">Cancel</Trans>
        </Button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  info: css({
    marginBottom: theme.spacing(2),
  }),
  buttonRow: css({
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  }),
});
