import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

const STATUS_COLORS = {
  alerting: 'red',
  pending: 'yellow',
  nodata: 'blue',
  normal: 'green',
  error: 'orange',
};

export function getInstanceStatByStatusScene(
  timeRange: SceneTimeRange,
  datasource: DataSourceRef,
  panelTitle: string,
  status: 'alerting' | 'pending' | 'nodata' | 'normal' | 'error'
) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr: `sum by (state) (grafanacloud_grafana_instance_alerting_alerts{state="${status}"})`,
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    height: '100%',
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription(panelTitle)
      .setData(query)
      .setOverrides((b) =>
        b.matchFieldsWithName(status).overrideColor({
          mode: 'fixed',
          fixedColor: STATUS_COLORS[status],
        })
      )
      .setNoValue('0')
      .build(),
  });
}
