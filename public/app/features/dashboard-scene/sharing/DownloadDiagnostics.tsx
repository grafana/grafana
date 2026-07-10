import { css } from '@emotion/css';
import { useAsyncFn } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  sceneGraph,
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectRef,
  type VizPanel,
} from '@grafana/scenes';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { downloadDiagnosticsForQueries } from 'app/features/query/diagnostics/downloadDiagnostics';

import { transformSceneToSaveModel, vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { getDashboardSceneFor, getQueryRunnerFor } from '../utils/utils';

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

function DownloadDiagnosticsRenderer({ model }: SceneComponentProps<DownloadDiagnostics>) {
  const { onDismiss, panelRef } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const styles = useStyles2(getStyles);

  const [{ loading: isGenerating }, onDownload] = useAsyncFn(async () => {
    const panel = panelRef?.resolve();
    if (!panel) {
      return;
    }
    const queryRunner = getQueryRunnerFor(panel);
    const queries = queryRunner?.state.queries ?? [];
    const timeRange = sceneGraph.getTimeRange(panel).state.value;

    // Panel/dashboard serialization is best-effort; on failure we still capture HAR + logs.
    let panelJSON: unknown;
    let dashboardJSON: unknown;
    try {
      panelJSON = vizPanelToPanel(panel);
    } catch (err) {
      console.warn('Diagnostics: failed to serialize panel JSON', err);
    }
    try {
      dashboardJSON = transformSceneToSaveModel(dashboard);
    } catch (err) {
      console.warn('Diagnostics: failed to serialize dashboard JSON', err);
    }

    await downloadDiagnosticsForQueries(
      queries,
      String(timeRange.from.valueOf()),
      String(timeRange.to.valueOf()),
      panelJSON,
      dashboardJSON
    );
  }, [dashboard, panelRef]);

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
