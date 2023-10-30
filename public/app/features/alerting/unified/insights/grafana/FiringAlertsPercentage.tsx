import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { PANEL_STYLES } from '../../home/Insights';

export function getFiringAlertsScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr: 'sum(count_over_time({from="state-history"} | json | current="Alerting"[1w]))',
      },
      {
        refId: 'B',
        instant: true,
        expr: 'sum(count_over_time({from="state-history"} | json [1w]))',
      },
    ],
  });

  const transformation = new SceneDataTransformer({
    $data: query,
    transformations: [
      {
        id: 'calculateField',
        options: {
          mode: 'binary',
          reduce: {
            reducer: 'mean',
          },
          replaceFields: false,
          binary: {
            left: 'Value #A',
            reducer: 'sum',
            operator: '*',
            right: '100',
          },
        },
      },
      {
        id: 'calculateField',
        options: {
          mode: 'binary',
          reduce: {
            reducer: 'sum',
          },
          binary: {
            left: 'Value #A * 100',
            reducer: 'sum',
            operator: '/',
            right: 'Value #B',
          },
          replaceFields: true,
        },
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription(panelTitle)
      .setData(transformation)
      .setUnit('percent')
      .build(),
  });
}
