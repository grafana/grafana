import { PromQuery } from '@grafana/prometheus';
import { SceneCSSGridItem, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';

import { getAutoQueriesForMetric } from '../autoQuery/getAutoQueriesForMetric';
import { getVariablesWithMetricConstant, MDP_METRIC_PREVIEW, trailDS } from '../shared';
import { getColorByIndex } from '../utils';

import { AddToExplorationButton } from './AddToExplorationsButton';
import { SelectMetricAction } from './SelectMetricAction';
import { hideEmptyPreviews } from './hideEmptyPreviews';

export function getPreviewPanelFor(metric: string, index: number, currentFilterCount: number, description?: string) {
  const autoQuery = getAutoQueriesForMetric(metric);

  const vizPanel = autoQuery.preview
    .vizBuilder()
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setDescription(description)
    .setHeaderActions([
      new SelectMetricAction({ metric, title: 'Select' }),
      new AddToExplorationButton({ labelName: metric }),
    ])
    .build();

  const queries = autoQuery.preview.queries.map((query) =>
    convertPreviewQueriesToIgnoreUsage(query, currentFilterCount)
  );

  return new SceneCSSGridItem({
    $variables: new SceneVariableSet({
      variables: getVariablesWithMetricConstant(metric),
    }),
    $behaviors: [hideEmptyPreviews(metric)],
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: MDP_METRIC_PREVIEW,
      queries,
    }),
    body: vizPanel,
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
