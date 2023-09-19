import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

const TOP_5_FIRING_INSTANCES = 'topk(10, sum by (alertname) (ALERTS))';

export function getMostFiredInstancesScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: TOP_5_FIRING_INSTANCES,
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
    width: 'calc(50% - 8px)',
    height: 300,
    body: PanelBuilders.table().setTitle(panelTitle).setData(transformation).build(),
  });
}
