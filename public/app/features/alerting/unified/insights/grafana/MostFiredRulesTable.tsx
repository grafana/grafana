import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { PANEL_STYLES } from '../../home/Insights';

export function getMostFiredRulesScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'topk(5, sum by(group, labels_grafana_folder) (count_over_time({from="state-history"} | json | current = `Alerting` [1w])))',
        instant: true,
      },
    ],
  });

  const transformation = new SceneDataTransformer({
    $data: query,
    transformations: [
      {
        id: 'sortBy',
        options: {
          fields: {},
          sort: [
            {
              field: 'Value #A',
              desc: true,
            },
          ],
        },
      },
      {
        id: 'organize',
        options: {
          excludeByName: {
            Time: true,
          },
          indexByName: {
            group: 0,
            labels_grafana_folder: 1,
            'Value #A': 2,
          },
          renameByName: {
            group: 'Group',
            labels_grafana_folder: 'Folder',
            'Value #A': 'Number of fires',
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
