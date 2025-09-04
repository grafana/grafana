import { SceneObjectBase, SceneObjectState, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useQueryRunner, useVariableValue, useVariableValues } from '@grafana/scenes-react';
import { BarAlignment, GraphDrawStyle, VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/ui';

import { overrideToFixedColor } from '../../home/Insights';

import { VARIABLES } from './constants';
import { METRIC_NAME, getDataQuery, stringifyGroupFilter, useQueryFilter } from './utils';

/**
 * Viz config for the summary chart - used by the React component
 */
export const summaryChartVizConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
  .setCustomFieldConfig('barWidthFactor', 1)
  .setCustomFieldConfig('barAlignment', BarAlignment.Center)
  .setCustomFieldConfig('fillOpacity', 60)
  .setCustomFieldConfig('lineWidth', 0)
  .setCustomFieldConfig('stacking', { mode: StackingMode.None })
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .setOption('legend', {
    showLegend: false,
    displayMode: LegendDisplayMode.Hidden,
  })
  .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
  .setMin(0)
  .setOverrides((builder) =>
    builder
      .matchFieldsWithName('firing')
      .overrideColor(overrideToFixedColor('firing'))
      .matchFieldsWithName('pending')
      .overrideColor(overrideToFixedColor('pending'))
  )
  .build();

export function SummaryChartReact() {
  const filter = useQueryFilter();

  const dataProvider = useQueryRunner({
    queries: [
      getDataQuery(`count by (alertstate) (${METRIC_NAME}{${filter}})`, {
        legendFormat: '{{alertstate}}', // we need this so we can map states to the correct color in the vizConfig
      }),
    ],
  });

  return <VizPanel title="" viz={summaryChartVizConfig} dataProvider={dataProvider} hoverHeader={true} />;
}

// simple wrapper so we can render the Chart using a Scene parent
export class SummaryChartScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryChartReact;
}
