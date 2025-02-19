import { PromQuery } from '@grafana/prometheus';
import { SceneCSSGridItem, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';

import { PanelMenu } from '../Menu/PanelMenu';
import { getAutoQueriesForMetric } from '../autoQuery/getAutoQueriesForMetric';
import { getVariablesWithMetricConstant, MDP_METRIC_PREVIEW, trailDS } from '../shared';
import { getColorByIndex } from '../utils';

import { NativeHistogramBadge } from './NativeHistogramBadge';
import { SelectMetricAction } from './SelectMetricAction';
import { hideEmptyPreviews } from './hideEmptyPreviews';

export function getPreviewPanelFor(
  metric: string,
  index: number,
  currentFilterCount: number,
  description?: string,
  nativeHistogram?: boolean,
  hideMenu?: boolean
) {
  const autoQuery = getAutoQueriesForMetric(metric, nativeHistogram);
  let actions: Array<SelectMetricAction | NativeHistogramBadge> = [new SelectMetricAction({ metric, title: 'Select' })];

  if (nativeHistogram) {
    actions.unshift(new NativeHistogramBadge({}));
  }

  let vizPanelBuilder = autoQuery.preview
    .vizBuilder()
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setDescription(description)
    .setHeaderActions(actions)
    .setShowMenuAlways(true)
    .setMenu(new PanelMenu({ labelName: metric }));

  if (!hideMenu) {
    vizPanelBuilder = vizPanelBuilder.setShowMenuAlways(true).setMenu(new PanelMenu({ labelName: metric }));
  }

  const vizPanel = vizPanelBuilder.build();

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
  const replacement = currentFilterCount > 0 ? '__ignore_usage__="",${filters}' : '__ignore_usage__=""';

  const expr = query.expr?.replace('${filters}', replacement);

  return {
    ...query,
    expr,
  };
}
