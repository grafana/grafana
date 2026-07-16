import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import {
  sceneGraph,
  type SceneComponentProps,
  SceneDataTransformer,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import {
  type DashboardDiagnosticsPanel,
  downloadDashboardDiagnostics,
  getDashboardDiagnosticsStatus,
  startDashboardDiagnostics,
} from 'app/features/query/diagnostics/downloadDiagnostics';

import { type DashboardScene } from '../scene/DashboardScene';

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

// panel.state.key is "panel-<id>"; parse the numeric id without importing utils (import cycle, as above).
function panelIdFrom(panel: VizPanel): number {
  return parseInt(panel.state.key?.replace('panel-', '') ?? '0', 10);
}

// Collects every data panel's queries (with the runner-level datasource filled in and hidden queries
// dropped, mirroring the single-panel view) into the whole-dashboard request payload. Panels with no
// active queries (e.g. text panels) are omitted.
function collectDashboardPanels(dashboard: DashboardScene): DashboardDiagnosticsPanel[] {
  const vizPanels = sceneGraph.findAllObjects(dashboard, (o) => o instanceof VizPanel);
  const panels: DashboardDiagnosticsPanel[] = [];
  // Repeat-by-variable clones share their source panel's key (e.g. `panel-3-clone-1` and
  // `panel-3-clone-2` both parse to id 3 in panelIdFrom), so track how many times each id has
  // already been seen and disambiguate repeats with a negative id -- real panel ids are never
  // negative, so this can't collide with another panel's id.
  const seenCounts = new Map<number, number>();

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
    const baseId = panelIdFrom(panel);
    const occurrence = seenCounts.get(baseId) ?? 0;
    seenCounts.set(baseId, occurrence + 1);
    panels.push({
      id: occurrence === 0 ? baseId : -(baseId * 1000 + occurrence),
      title: panel.state.title ?? '',
      from: String(timeRange.from.valueOf()),
      to: String(timeRange.to.valueOf()),
      queries,
    });
  }

  return panels;
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
    const panels = collectDashboardPanels(dashboard);
    // Known limitation (follow-up): template variables are sent un-interpolated, so captured traffic
    // won't match panels that use $vars until per-datasource interpolation is applied.
    if (panels.length === 0) {
      throw new Error(t('dashboard.diagnostics.no-panels', 'This dashboard has no panels with active queries.'));
    }

    const controller = new AbortController();
    abortRef.current = controller;
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
          The bundle can include request headers, query parameters, and server log lines. Review it before sharing
          outside your organization.
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
