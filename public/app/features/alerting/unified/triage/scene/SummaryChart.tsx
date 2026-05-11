import { SceneObjectBase, type SceneObjectState, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useDataTransformer, useQueryRunner } from '@grafana/scenes-react';
import { BarAlignment, GraphDrawStyle, VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/ui';

import { overrideToFixedColor } from '../../home/Insights';

import { sortByAlertState } from './dataFrameUtils';
import { summaryChartQuery } from './queries';
import { cleanAlertStateFilter, useQueryFilter } from './utils';

/**
 * Viz config for the summary chart - used by the React component
 */
export const summaryChartVizConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
  .setCustomFieldConfig('barWidthFactor', 1)
  .setCustomFieldConfig('barAlignment', BarAlignment.Center)
  .setCustomFieldConfig('fillOpacity', 80)
  .setCustomFieldConfig('lineWidth', 0)
  .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
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
  // summaryChartQuery groups by alertstate, so remove any user-supplied alertstate matcher.
  const cleanFilter = cleanAlertStateFilter(filter);

  const queryRunner = useQueryRunner({
    queries: [summaryChartQuery(cleanFilter)],
  });

  const dataProvider = useDataTransformer({
    data: queryRunner,
    transformations: [sortByAlertState],
  });

  return <VizPanel title="" viz={summaryChartVizConfig} dataProvider={dataProvider} hoverHeader={true} />;
}

// simple wrapper so we can render the Chart using a Scene parent
export class SummaryChartScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryChartReact;
}
