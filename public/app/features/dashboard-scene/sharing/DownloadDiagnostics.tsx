import { useEffect, useRef } from 'react';
import { useAsyncFn } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import {
  sceneGraph,
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectRef,
  type VizPanel,
} from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { downloadDiagnosticsForQueries } from 'app/features/query/diagnostics/downloadDiagnostics';

import { DiagnosticsDrawerContent } from './DiagnosticsDrawerContent';
import { getQueryRunnerFor } from './diagnosticsUtils';
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
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight request if the drawer unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const [{ loading: isGenerating, error }, onDownload] = useAsyncFn(
    async (includeLogs: boolean) => {
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

      const controller = new AbortController();
      abortRef.current = controller;
      await downloadDiagnosticsForQueries(queries, String(timeRange.from.valueOf()), String(timeRange.to.valueOf()), {
        includeLogs,
        signal: controller.signal,
      });
    },
    [panelRef]
  );

  const handleDismiss = () => {
    abortRef.current?.abort();
    onDismiss?.();
  };

  return (
    <DiagnosticsDrawerContent
      description={
        <Trans i18nKey="dashboard.diagnostics.info-text-panel">
          Generates a diagnostic bundle for this panel by re-running its queries with HTTP capture active. The download
          may take a moment while the bundle is generated.
        </Trans>
      }
      error={error}
      isGenerating={isGenerating}
      onDownload={onDownload}
      onDismiss={handleDismiss}
    />
  );
}
