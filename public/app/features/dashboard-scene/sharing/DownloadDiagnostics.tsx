import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
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
  type VizPanel,
} from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { downloadDiagnosticsForQueries } from 'app/features/query/diagnostics/downloadDiagnostics';

import { type DashboardScene } from '../scene/DashboardScene';

import { type SceneShareTabState, type ShareView } from './types';

export interface DownloadDiagnosticsState extends SceneShareTabState {
  // The panel this diagnostics bundle is scoped to.
  panelRef?: SceneObjectRef<VizPanel>;
  // The panel's dashboard, so its save model (and this panel's JSON within it) can be bundled.
  dashboardRef?: SceneObjectRef<DashboardScene>;
}

export class DownloadDiagnostics extends SceneObjectBase<DownloadDiagnosticsState> implements ShareView {
  static Component = DownloadDiagnosticsRenderer;

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
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Finds a panel in a v1 dashboard by id, recursing into collapsed rows (which carry their children
// in a nested "panels" array).
function findV1PanelSaveModel(panels: unknown, id: number): unknown {
  if (!Array.isArray(panels)) {
    return undefined;
  }
  for (const p of panels) {
    if (!isRecord(p)) {
      continue;
    }
    if (p.id === id) {
      return p;
    }
    const nested = findV1PanelSaveModel(p.panels, id);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

// V1 dashboards store panels in panels[], while v2 dashboards store them in elements keyed by the
// scene panel key. Kept dependency-free to avoid the serialization/utils import cycle the rest of
// this file works around.
function findPanelSaveModel(dashboard: unknown, panel: VizPanel): unknown {
  if (!isRecord(dashboard)) {
    return undefined;
  }

  if (isRecord(dashboard.elements) && panel.state.key) {
    return dashboard.elements[panel.state.key];
  }

  return findV1PanelSaveModel(dashboard.panels, panelIdFrom(panel));
}

// The download uses a blob-response fetch, whose FetchError carries the detail in status/statusText
// (its data is a Blob and message is unset), so build a message from those rather than error.message
// which would leave the alert body empty.
function diagnosticsErrorMessage(error: Error): string {
  if (isFetchError(error)) {
    const parts = [error.status, error.statusText].filter(Boolean);
    return parts.length ? parts.join(' ') : t('dashboard.diagnostics.request-failed', 'Request failed');
  }
  return error.message || t('dashboard.diagnostics.error-title', 'Failed to generate diagnostics');
}

function DownloadDiagnosticsRenderer({ model }: SceneComponentProps<DownloadDiagnostics>) {
  const { onDismiss, panelRef, dashboardRef } = model.useState();
  const styles = useStyles2(getStyles);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight request if the drawer unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const [{ loading: isGenerating, error }, onDownload] = useAsyncFn(async () => {
    const panel = panelRef?.resolve();
    if (!panel) {
      return;
    }
    const runner = getQueryRunnerFor(panel);
    // Classic panels keep the datasource on the query runner rather than on each target, and unlike
    // the normal /api/ds/query path nothing fills that in here. Copy the runner-level datasource
    // onto any query that lacks one so the diagnostics endpoint can still route them.
    const runnerDatasource = runner?.state.datasource;
    const queries: DataQuery[] = (runner?.state.queries ?? []).map((query) =>
      query.datasource ? query : { ...query, datasource: runnerDatasource }
    );
    // Known limitation (follow-up): template variables are sent un-interpolated, so captured
    // traffic won't match a panel that uses $vars until per-datasource interpolation is applied.
    if (queries.filter((query) => !query.hide).length === 0) {
      throw new Error(t('dashboard.diagnostics.no-queries', 'This panel has no active queries to capture.'));
    }
    const timeRange = sceneGraph.getTimeRange(panel).state.value;

    // Bundle this panel's JSON and the dashboard JSON for context. The panel's save model is resolved
    // from the dashboard save model rather than serialized separately (avoids the serialization
    // import cycle this view already works around); undefined models are simply not sent.
    const dashboardModel = dashboardRef?.resolve().getSaveModel();
    const panelModel = findPanelSaveModel(dashboardModel, panel);

    const controller = new AbortController();
    abortRef.current = controller;
    await downloadDiagnosticsForQueries(
      queries,
      String(timeRange.from.valueOf()),
      String(timeRange.to.valueOf()),
      controller.signal,
      panelModel,
      dashboardModel
    );
  }, [panelRef, dashboardRef]);

  const handleDismiss = () => {
    abortRef.current?.abort();
    onDismiss?.();
  };

  return (
    <div>
      <p className={styles.info}>
        <Trans i18nKey="dashboard.diagnostics.info-text-panel">
          Generates a diagnostic bundle for this panel by re-running its queries with HTTP capture active. The download
          may take a moment while the bundle is generated.
        </Trans>
      </p>

      {/* Seed warning. Additional warnings (e.g. sensitive-data redaction, large bundles) are added here later. */}
      <Alert
        severity="warning"
        title={t('dashboard.diagnostics.sensitive-warning-title', 'May contain sensitive data')}
      >
        <Trans i18nKey="dashboard.diagnostics.sensitive-warning-body">
          The bundle can include request headers, query parameters, and server log lines. Review it before sharing
          outside your organization.
        </Trans>
      </Alert>

      {/* Diagnostic options (artifact selection, time range, redaction toggles) will be added here. */}

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
