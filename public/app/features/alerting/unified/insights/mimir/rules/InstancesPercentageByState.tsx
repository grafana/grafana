import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle } from '@grafana/schema';

const QUERY = 'sum by (alertstate) (ALERTS) / ignoring(alertstate) group_left sum(ALERTS)';

export function getInstancesPercentageByStateScene(
  timeRange: SceneTimeRange,
  datasource: DataSourceRef,
  panelTitle: string
) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: QUERY,
        range: true,
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    width: 'calc(50% - 4px)',
    height: 300,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .build(),
  });
}
