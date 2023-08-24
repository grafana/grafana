import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

const QUERY = 'sum by (alertstate) (ALERTS{alertstate="firing"})';

export function getFiringCloudAlertsScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr: QUERY,
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    width: 'calc(25% - 4px)',
    height: 300,
    body: PanelBuilders.stat().setTitle(panelTitle).setData(query).build(),
  });
}
