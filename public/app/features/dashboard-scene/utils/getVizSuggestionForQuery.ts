import { firstValueFrom, timeout } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  CoreApp,
  type DataFrame,
  getDefaultTimeRange,
  LoadingState,
  type PanelPluginVisualizationSuggestion,
  type TimeRange,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner, type SceneObject, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';
import { getNextRequestId } from 'app/features/query/state/PanelQueryRunner';
import { runRequest } from 'app/features/query/state/runRequest';

import { type DashboardScene } from '../scene/DashboardScene';

const SUGGESTION_TIMEOUT_MS = 5_000;

/**
 * Executes a saved query against its datasource and returns the top visualization suggestion
 * based on the resulting data shape.
 */
export async function getVizSuggestionForQuery(
  query: DataQuery,
  timeRange: TimeRange = getDefaultTimeRange()
): Promise<PanelPluginVisualizationSuggestion | undefined> {
  const datasource = await getDataSourceSrv().get(query.datasource ?? null);

  const request = {
    requestId: getNextRequestId(),
    app: CoreApp.Dashboard,
    targets: [query],
    range: timeRange,
    timezone: 'browser',
    interval: '1m',
    intervalMs: 60000,
    maxDataPoints: 500,
    scopedVars: {},
    startTime: Date.now(),
  };

  const panelData = await firstValueFrom(
    runRequest(datasource, request).pipe(
      filter((data) => data.state === LoadingState.Done || data.state === LoadingState.Error),
      timeout(SUGGESTION_TIMEOUT_MS)
    )
  );

  const series: DataFrame[] = panelData.series ?? [];
  const { suggestions } = await getAllSuggestions(series);

  return suggestions[0];
}

// Inlined here (rather than imported from utils/utils.ts) to avoid a circular dependency:
// getVizSuggestionForQuery → utils → DashboardScene → UnconfiguredPanel → getVizSuggestionForQuery
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

/**
 * Applies a saved query and its top viz suggestion to an unconfigured panel:
 * changes the plugin type, optionally updates the panel title, sets the datasource
 * and query on the runner, and triggers execution.
 */
export async function applyQueryToPanel(
  panel: VizPanel,
  dashboard: DashboardScene,
  query: DataQuery,
  suggestion: PanelPluginVisualizationSuggestion,
  title?: string
): Promise<void> {
  await dashboard.changePanelPlugin(panel, suggestion.pluginId, suggestion.options ?? {}, suggestion.fieldConfig);

  if (title) {
    dashboard.updatePanelTitle(panel, title);
  }

  const queryRunner = getQueryRunnerFor(panel);
  if (queryRunner) {
    queryRunner.setState({
      datasource: query.datasource ?? undefined,
      queries: [{ ...query, refId: query.refId || 'A' }],
    });
    queryRunner.runQueries();
  }
}
