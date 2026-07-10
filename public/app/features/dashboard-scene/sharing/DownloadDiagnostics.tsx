import { css } from '@emotion/css';
import { useAsyncFn } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
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

function DownloadDiagnosticsRenderer({ model }: SceneComponentProps<DownloadDiagnostics>) {
  const { onDismiss, panelRef } = model.useState();
  const styles = useStyles2(getStyles);

  const [{ loading: isGenerating, error }, onDownload] = useAsyncFn(async () => {
    const panel = panelRef?.resolve();
    if (!panel) {
      return;
    }
    const queries: DataQuery[] = getQueryRunnerFor(panel)?.state.queries ?? [];
    const timeRange = sceneGraph.getTimeRange(panel).state.value;

    await downloadDiagnosticsForQueries(queries, String(timeRange.from.valueOf()), String(timeRange.to.valueOf()));
  }, [panelRef]);

  return (
    <main>
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
          {error.message}
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
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="dashboard.diagnostics.cancel-button">Cancel</Trans>
        </Button>
      </div>
    </main>
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
