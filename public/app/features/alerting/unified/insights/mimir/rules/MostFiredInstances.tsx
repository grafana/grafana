import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

export function getMostFiredInstancesScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'topk(10, sum by (alertname) (ALERTS))',
        range: true,
      },
    ],

    $timeRange: timeRange,
  });

  const transformation = new SceneDataTransformer({
    $data: query,
    transformations: [
      {
        id: 'timeSeriesTable',
        options: {},
      },
      {
        id: 'organize',
        options: {
          excludeByName: {},
          indexByName: {},
          renameByName: {
            Trend: '',
            alertname: 'Alert Rule Name',
          },
        },
      },
    ],
  });

  return new SceneFlexItem({
    minHeight: 300,
    body: PanelBuilders.table().setTitle(panelTitle).setData(transformation).build(),
  });
}
