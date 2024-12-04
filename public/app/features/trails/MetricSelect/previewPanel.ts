import { PromQuery } from '@grafana/prometheus';
import { config } from '@grafana/runtime';
import { SceneCSSGridItem, SceneObject, SceneObjectState, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';

import { getAutoQueriesForMetric } from '../AutomaticMetricQueries/AutoQueryEngine';
import { getVariablesWithMetricConstant, MDP_METRIC_PREVIEW, trailDS } from '../shared';
import { getColorByIndex } from '../utils';
import { WithUsageDataPreviewPanel } from '../wingman/WithUsageDataPreviewPanel';

import { AddToExplorationButton } from './AddToExplorationsButton';
import { SelectMetricAction } from './SelectMetricAction';
import { hideEmptyPreviews } from './hideEmptyPreviews';

type HeaderActions = Array<SceneObject<SceneObjectState>>;

export function getPreviewPanelFor(
  metric: string,
  index: number,
  currentFilterCount: number,
  description?: string,
  headerActions?: HeaderActions,
  datasource: { uid: string } = trailDS
) {
  const autoQuery = getAutoQueriesForMetric(metric);
  const queries = autoQuery.preview.queries.map((query) =>
    convertPreviewQueriesToIgnoreUsage(query, currentFilterCount)
  );
  const vizPanel = autoQuery.preview
    .vizBuilder()
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setDescription(description)
    .setHeaderActions([
      ...(headerActions ?? []),
      new SelectMetricAction({ metric, title: 'Select' }),
      new AddToExplorationButton({ labelName: metric }),
    ])
    .setData(
      new SceneQueryRunner({
        datasource,
        maxDataPoints: MDP_METRIC_PREVIEW,
        queries,
      })
    )
    .build();

  let panel: SceneObject = vizPanel;

  if (config.featureToggles.exploreMetricsWingman) {
    panel = new WithUsageDataPreviewPanel({
      vizPanelInGridItem: vizPanel,
      metric,
    });
  }

  return new SceneCSSGridItem({
    $variables: new SceneVariableSet({
      variables: getVariablesWithMetricConstant(metric),
    }),
    $behaviors: [hideEmptyPreviews(metric)],
    body: panel,
  });
}

function convertPreviewQueriesToIgnoreUsage(query: PromQuery, currentFilterCount: number) {
  // If there are filters, we append to the list. Otherwise, we replace the empty list.
  const replacement = currentFilterCount > 0 ? '${filters},__ignore_usage__=""' : '__ignore_usage__=""';

  const expr = query.expr?.replace('${filters}', replacement);

  return {
    ...query,
    expr,
  };
}
