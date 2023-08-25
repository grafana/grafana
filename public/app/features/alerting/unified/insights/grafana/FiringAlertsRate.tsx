import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, LineInterpolation } from '@grafana/schema';

const RATE_FIRING = 'sum(count_over_time({from="state-history"} | json | current="Alerting"[5m]))';

export function getFiringAlertsRateScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: RATE_FIRING,
        range: true,
        instant: false,
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    width: 'calc(50% - 8px)',
    height: 300,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setCustomFieldConfig('lineInterpolation', LineInterpolation.Linear)
      .setCustomFieldConfig('fillOpacity', 10)
      .setCustomFieldConfig('spanNulls', true)
      .setCustomFieldConfig('pointSize', 5)
      .setOverrides((b) => b.matchFieldsWithName('{}').overrideDisplayName('Number of fires'))
      .build(),
  });
}
