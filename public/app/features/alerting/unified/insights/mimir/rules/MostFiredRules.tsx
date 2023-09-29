import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { PANEL_STYLES } from '../../../home/Insights';

export function getMostFiredRulesScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'topk(10, sum by(alertname) (ALERTS{alertstate="firing"}))',
        instant: true,
        range: false,
        format: 'table',
      },
    ],

    $timeRange: timeRange,
  });

  const transformation = new SceneDataTransformer({
    $data: query,
    transformations: [
      {
        id: 'organize',
        options: {
          excludeByName: {
            Time: true,
          },
          indexByName: {},
          renameByName: {
            Value: 'Fires this week',
            alertname: 'Alert Rule Name',
          },
        },
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.table().setTitle(panelTitle).setDescription(panelTitle).setData(transformation).build(),
  });
}
