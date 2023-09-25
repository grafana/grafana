import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { PANEL_STYLES } from '../../../home/Insights';

export function getMissedIterationsScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'sum(grafanacloud_instance_rule_group_iterations_missed_total:rate5m)',
        range: true,
        legendFormat: 'missed',
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription(panelTitle)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOption('legend', { showLegend: false })
      .setOverrides((b) =>
        b.matchFieldsWithName('missed').overrideColor({
          mode: 'fixed',
          fixedColor: 'red',
        })
      )
      .build(),
  });
}
