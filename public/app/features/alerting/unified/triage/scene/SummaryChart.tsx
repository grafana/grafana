import { PanelBuilders, SceneObjectBase, SceneObjectState, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useQueryRunner, useVariableValue, useVariableValues } from '@grafana/scenes-react';
import { GraphDrawStyle, LineInterpolation, VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/ui';

import { overrideToFixedColor } from '../../home/Insights';

import { VARIABLES } from './constants';
import { METRIC_NAME, getDataQuery, getQueryRunner, stringifyGroupFilter } from './utils';

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

/**
 * Viz config for the summary chart - used by the React component
 */
export const summaryChartVizConfig = VizConfigBuilders.timeseries()
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
  .build();

export class SummaryChartScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryChartReact;
}

export function SummaryChartReact() {
  const [groupBy = []] = useVariableValues<string>(VARIABLES.groupBy);
  const [filters = ''] = useVariableValue<string>(VARIABLES.filters);

  const groupByFilter = stringifyGroupFilter(groupBy);
  const queryFilter = [groupByFilter, filters].filter((s) => Boolean(s)).join(',');

  const query = getDataQuery(`count by (alertstate) (${METRIC_NAME}{${queryFilter}})`, {
    legendFormat: '{{alertstate}}', // we need this so we can map states to the correct color in the vizConfig
  });
  const dataProvider = useQueryRunner({
    queries: [query],
  });

  return <VizPanel title="" viz={summaryChartVizConfig} dataProvider={dataProvider} collapsible={true} />;
}
