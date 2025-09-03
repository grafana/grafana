import { VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useQueryRunner } from '@grafana/scenes-react';
import {
  AxisPlacement,
  GraphDrawStyle,
  LegendDisplayMode,
  LineInterpolation,
  StackingMode,
  TooltipDisplayMode,
  VisibilityMode,
} from '@grafana/schema';

import { overrideToFixedColor } from '../../home/Insights';

import { METRIC_NAME, getDataQuery } from './utils';

/**
 * Viz config for the alert rule summary chart - used by the React component
 */
export const alertRuleSummaryVizConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
  .setCustomFieldConfig('lineInterpolation', LineInterpolation.StepBefore)
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .setCustomFieldConfig('fillOpacity', 50)
  .setCustomFieldConfig('lineWidth', 0)
  .setCustomFieldConfig('stacking', { mode: StackingMode.None })
  .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
  .setMin(0)
  .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
  .setOption('legend', {
    showLegend: false,
    displayMode: LegendDisplayMode.Hidden,
  })
  .setOverrides((builder) =>
    builder
      .matchFieldsWithName('firing')
      .overrideColor(overrideToFixedColor('firing'))
      .matchFieldsWithName('pending')
      .overrideColor(overrideToFixedColor('pending'))
  )
  .build();

export function AlertRuleSummary({ ruleUID }: { ruleUID: string }) {
  // Create query that filters by rule UID and partitions by alert state
  // This replaces the scene transformations with a direct query approach
  const query = getDataQuery(`count by (alertstate) (${METRIC_NAME}{grafana_rule_uid="${ruleUID}"})`, {
    legendFormat: '{{alertstate}}', // This ensures field names match the override patterns
    interval: '1m',
  });

  const queryRunner = useQueryRunner({
    queries: [query],
  });

  return (
    <VizPanel
      title=""
      viz={alertRuleSummaryVizConfig}
      dataProvider={queryRunner}
      hoverHeader={true}
      displayMode="transparent"
      collapsible={false}
    />
  );
}
