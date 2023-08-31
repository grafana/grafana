import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle } from '@grafana/schema';

const QUERY_A = 'sum by (cluster)(grafanacloud_instance_alertmanager_invalid_config)';

export function getInvalidConfigScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: QUERY_A,
        range: true,
        legendFormat: '{{cluster}}',
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
      .setUnit('bool_yes_no')
      .build(),
  });
}
