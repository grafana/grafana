import { PanelBuilders, SceneFlexItem } from '@grafana/scenes';
import { GraphDrawStyle } from '@grafana/schema';
import { LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/ui';

import { overrideToFixedColor } from '../../home/Insights';

import { METRIC_NAME, getQueryRunner } from './utils';

/**
 * This function creates a SceneFlexItem with a timeseries panel that shows the events.
 */
export const summaryChart = new SceneFlexItem({
  minHeight: 250,
  body: PanelBuilders.timeseries()
    .setDescription('@TODO decription here')
    .setData(
      getQueryRunner(`count by (alertstate) (${METRIC_NAME}{})`, {
        // this is important to make the overrides below work properly since this will parse
        // the results as {alertstate="firing"} -> firing
        legendFormat: '__auto',
        interval: '1m',
      })
    )
    .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
    .setCustomFieldConfig('barWidthFactor', 0.75)
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal, group: 'states' })
    .setOption('legend', {
      showLegend: false,
      displayMode: LegendDisplayMode.Hidden,
    })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
    .setOverrides((builder) =>
      builder
        .matchFieldsWithName('firing')
        .overrideColor(overrideToFixedColor('firing'))
        .matchFieldsWithName('pending')
        .overrideColor(overrideToFixedColor('pending'))
    )
    .setNoValue('0')
    .build(),
});
