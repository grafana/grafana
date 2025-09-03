import { PanelBuilders, VizConfigBuilders, SceneObjectState, SceneObjectBase } from '@grafana/scenes';
import { GraphDrawStyle, LineInterpolation, VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/ui';

import { overrideToFixedColor } from '../../home/Insights';

import { DS_UID, METRIC_NAME, getQueryRunner } from './utils';
import { useQueryRunner, VizPanel } from '@grafana/scenes-react';

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

export class SumamryChartScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryChartReact;
}

export function SummaryChartReact() {
  const dataProvider = useQueryRunner({
    queries: [
      {
        expr: `count by (alertstate) (${METRIC_NAME}{\${__alertsGroupBy.filters}})`,
        legendFormat: '__auto',
        interval: '1m',
        refId: 'A',
        datasource: {
          type: 'prometheus',
          uid: DS_UID,
        },
      },
    ],
  });

  return <VizPanel title="Summary Chart" viz={summaryChartVizConfig} dataProvider={dataProvider} collapsible={true} />;
}
