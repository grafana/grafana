import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

const TOP_5_FIRING_RULES =
  'topk(5, sum by(group, labels_grafana_folder) (count_over_time({from="state-history"} | json | current = `Alerting` [1w])))';

export function getMostFiredRulesScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: TOP_5_FIRING_RULES,
        instant: true,
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    width: 'calc(50% - 8px)',
    height: 300,
    body: PanelBuilders.table()
      .setTitle(panelTitle)
      .setData(query)
      .setOverrides((b) =>
        b
          .matchFieldsWithNameByRegex('.*')
          .overrideFilterable(false)
          .matchFieldsWithName('Time')
          .overrideCustomFieldConfig('hidden', true)
          .matchFieldsWithName('Value #A')
          .overrideDisplayName('Fires this week')
          .matchFieldsWithName('group')
          .overrideDisplayName('Group')
          .matchFieldsWithName('labels_grafana_folder')
          .overrideDisplayName('Folder')
      )
      .build(),
  });
}
