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
import { interpolateDiagnosticsQueries } from 'app/features/query/diagnostics/interpolateQueries';

import { type SceneShareTabState, type ShareView } from './types';

export interface DownloadDiagnosticsState extends SceneShareTabState {
  // The panel this diagnostics bundle is scoped to.
  panelRef?: SceneObjectRef<VizPanel>;
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
  const { onDismiss, panelRef } = model.useState();
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
    const rawQueries: DataQuery[] = (runner?.state.queries ?? []).map((query) =>
      query.datasource ? query : { ...query, datasource: runnerDatasource }
    );
    if (rawQueries.filter((query) => !query.hide).length === 0) {
      throw new Error(t('dashboard.diagnostics.no-queries', 'This panel has no active queries to capture.'));
    }
    // Create the controller before interpolating: interpolation awaits datasource round trips, so a
    // cancel or drawer unmount during that phase must abort here rather than no-op against a null ref
    // and let the download start after the UI is gone.
    const controller = new AbortController();
    abortRef.current = controller;

    // Interpolate template and scoped variables so the captured request matches the request the
    // panel actually ran; scopedVars carries the panel so scene variables (including a repeated
    // panel's clone-local value) resolve correctly.
    const queries = await interpolateDiagnosticsQueries(
      rawQueries,
      { __sceneObject: { value: panel } },
      runner?.state.data?.request?.filters
    );
    if (controller.signal.aborted) {
      return;
    }
    const timeRange = sceneGraph.getTimeRange(panel).state.value;

    await downloadDiagnosticsForQueries(
      queries,
      String(timeRange.from.valueOf()),
      String(timeRange.to.valueOf()),
      controller.signal
    );
  }, [panelRef]);

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
