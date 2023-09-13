import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

const TOTALS = 'sum(count_over_time({from="state-history"} | json [1w]))';
const TOTALS_FIRING = 'sum(count_over_time({from="state-history"} | json | current="Alerting"[1w]))';

export function getFiringAlertsScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr: TOTALS_FIRING,
      },
      {
        refId: 'B',
        instant: true,
        expr: TOTALS,
      },
    ],
    $timeRange: timeRange,
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
    minHeight: 300,
    body: PanelBuilders.stat().setTitle(panelTitle).setData(transformation).setUnit('percent').build(),
  });
}
