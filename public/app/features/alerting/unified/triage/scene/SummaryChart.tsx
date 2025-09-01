import { PanelBuilders } from '@grafana/scenes';
import { GraphDrawStyle, LineInterpolation, VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/ui';

import { overrideToFixedColor } from '../../home/Insights';

import { METRIC_NAME, getQueryRunner } from './utils';

/**
 * This function creates a SceneFlexItem with a timeseries panel that shows the events.
 */
export const summaryChart = PanelBuilders.timeseries()
  .setDescription('@TODO decription here')
  .setData(
    getQueryRunner(`count by (alertstate) (${METRIC_NAME}{\${__alertsGroupBy.filters}})`, {
      // this is important to make the overrides below work properly since this will parse
      // the results as {alertstate="firing"} -> firing
      legendFormat: '__auto',
      interval: '1m',
    })
  )
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
  .setCustomFieldConfig('fillOpacity', 30)
  .setCustomFieldConfig('stacking', { mode: StackingMode.None })
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .setCustomFieldConfig('lineInterpolation', LineInterpolation.StepAfter)
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
  .build();
