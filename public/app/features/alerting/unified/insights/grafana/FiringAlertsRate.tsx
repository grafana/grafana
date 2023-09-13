import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle } from '@grafana/schema';

const RATE_FIRING = 'sum(count_over_time({from="state-history"} | json | current="Alerting"[5m]))';

export function getFiringAlertsRateScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: RATE_FIRING,
        range: true,
        legendFormat: 'Number of fires',
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    minHeight: 300,
    minWidth: '40%',
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setCustomFieldConfig('fillOpacity', 10)
      .setCustomFieldConfig('spanNulls', true)
      .setCustomFieldConfig('pointSize', 5)
      .build(),
  });
}
