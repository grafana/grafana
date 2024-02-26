import { SceneCSSGridItem, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { SelectMetricAction } from '../SelectMetricAction';
import { hideEmptyPreviews } from '../hideEmptyPreviews';
import { getVariablesWithMetricConstant, trailDS } from '../shared';
import { getColorByIndex } from '../utils';

import { getAutoQueriesForMetric } from './AutoQueryEngine';

export function getPreviewPanelFor(metric: string, index: number, currentFilterCount: number) {
  const autoQuery = getAutoQueriesForMetric(metric);

  const vizPanel = autoQuery.preview
    .vizBuilder()
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
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
      maxDataPoints: 200,
      queries,
    }),
    body: vizPanel,
  });
}

function convertPreviewQueriesToIgnoreUsage(query: PromQuery, currentFilterCount: number) {
  // If there are filters, we append to the list. Otherwise, we replace the empty list.
  const replacement = currentFilterCount > 0 ? "${filters},__ignore_usage__=''" : "__ignore_usage__=''";

  const expr = query.expr?.replace('${filters}', replacement);

  return {
    ...query,
    expr,
  };
}
