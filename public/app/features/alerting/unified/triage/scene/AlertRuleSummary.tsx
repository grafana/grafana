import { VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useDataTransformer } from '@grafana/scenes-react';
import {
  AxisPlacement,
  BarAlignment,
  GraphDrawStyle,
  LegendDisplayMode,
  StackingMode,
  TooltipDisplayMode,
  VisibilityMode,
} from '@grafana/schema';

import { overrideToFixedColor } from '../../home/Insights';
import { useWorkbenchContext } from '../WorkbenchContext';

/**
 * Viz config for the alert rule summary chart - used by the React component
 */
export const alertRuleSummaryVizConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
  .setCustomFieldConfig('barWidthFactor', 1)
  .setCustomFieldConfig('barAlignment', BarAlignment.After)
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .setCustomFieldConfig('fillOpacity', 60)
  .setCustomFieldConfig('lineWidth', 0)
  .setCustomFieldConfig('stacking', { mode: StackingMode.None })
  .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
  .setCustomFieldConfig('axisGridShow', false)
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
  // Use WorkbenchContext to access the parent query runner and reuse its data
  const { queryRunner } = useWorkbenchContext();

  // Transform parent data to filter by this specific rule and partition by alert state
  const transformedData = useDataTransformer({
    data: queryRunner,
    transformations: [
      {
        id: 'filterByValue',
        options: {
          filters: [
            {
              config: {
                id: 'equal',
                options: {
                  value: ruleUID,
                },
              },
              fieldName: 'grafana_rule_uid',
            },
          ],
          match: 'any',
          type: 'include',
        },
      },
      {
        id: 'partitionByValues',
        options: {
          fields: ['alertstate'],
          keepFields: false,
          naming: {
            asLabels: true,
          },
        },
      },
    ],
  });

  return (
    <VizPanel
      title=""
      viz={alertRuleSummaryVizConfig}
      dataProvider={transformedData}
      hoverHeader={true}
      displayMode="transparent"
      collapsible={false}
    />
  );
}
