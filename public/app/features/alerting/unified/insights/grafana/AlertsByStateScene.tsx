import { PanelBuilders, SceneDataTransformer, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES, overrideToFixedColor } from '../../home/Insights';
import { InsightsMenuButton } from '../InsightsMenuButton';

export function getGrafanaInstancesByStateScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = INSTANCE_ID
    ? `sum by(state) (grafanacloud_grafana_instance_alerting_alerts{id="${INSTANCE_ID}"})`
    : 'sum by (state) (grafanacloud_grafana_instance_alerting_alerts)';

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: '{{state}}',
      },
    ],
  });

  const transformation = new SceneDataTransformer({
    $data: query,
    transformations: [
      {
        id: 'renameByRegex',
        options: {
          regex: 'alerting',
          renamePattern: 'firing',
        },
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    height: '400px',
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('A breakdown of all of your alert rule instances based on state')
      .setData(transformation)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOverrides((b) =>
        b
          .matchFieldsWithName('firing')
          .overrideColor(overrideToFixedColor('firing'))
          .matchFieldsWithName('normal')
          .overrideColor(overrideToFixedColor('normal'))
          .matchFieldsWithName('pending')
          .overrideColor(overrideToFixedColor('pending'))
          .matchFieldsWithName('recovering')
          .overrideColor(overrideToFixedColor('recovering'))
          .matchFieldsWithName('error')
          .overrideColor(overrideToFixedColor('error'))
          .matchFieldsWithName('nodata')
          .overrideColor(overrideToFixedColor('nodata'))
      )
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
