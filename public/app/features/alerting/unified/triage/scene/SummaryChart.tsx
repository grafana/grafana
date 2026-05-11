import { groupBy, map as lmap } from 'lodash';
import { type Observable, map } from 'rxjs';

import { type CustomTransformOperator, type DataFrame, FieldType } from '@grafana/data';
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

/**
 * Collapses time series frames that share the same alertstate label into a single frame per
 * alertstate by summing their values at each timestamp.
 *
 * This is needed because SceneQueryRunner injects GroupBy/AdHocFilters variables into every
 * Prometheus request, which causes the backend to expand the query's grouping (e.g.
 * `count by (alertstate)` becomes `count by (alertstate, grafana_folder)`), producing
 * multiple frames per alertstate. This transformation re-aggregates them back to one frame
 * per alertstate by summing the values.
 */
export const collapseByAlertstateTransformation: CustomTransformOperator = () => (source: Observable<DataFrame[]>) =>
  source.pipe(
    map((frames: DataFrame[]) =>
      lmap(
        groupBy(frames, (f) => f.fields.find((field) => field.type === FieldType.number)?.labels?.alertstate ?? ''),
        (groupFrames) => {
          if (groupFrames.length === 1) {
            return groupFrames[0];
          }
          const first = groupFrames[0];
          const timeField = first.fields.find((f) => f.type === FieldType.time);
          const valueField = first.fields.find((f) => f.type === FieldType.number);
          if (!timeField || !valueField) {
            return first;
          }
          // Each grouped frame covers a different time window: Prometheus only returns
          // timestamps where that series was active. Build a timestamp→sum map across all
          // frames so values at the same wall-clock time are combined correctly, regardless
          // of each frame's start/end or number of data points.
          const sums = new Map<number, number>();
          for (const frame of groupFrames) {
            const times: number[] = frame.fields.find((f) => f.type === FieldType.time)?.values ?? [];
            const values: number[] = frame.fields.find((f) => f.type === FieldType.number)?.values ?? [];
            for (let i = 0; i < times.length; i++) {
              sums.set(times[i], (sums.get(times[i]) ?? 0) + (values[i] ?? 0));
            }
          }
          const sortedTimes = Array.from(sums.keys()).sort((a, b) => a - b);
          return {
            ...first,
            length: sortedTimes.length,
            fields: [
              { ...timeField, values: sortedTimes },
              { ...valueField, values: sortedTimes.map((ts) => sums.get(ts) ?? 0) },
            ],
          };
        }
      )
    )
  );

export function SummaryChartReact() {
  const filter = useQueryFilter();
  // summaryChartQuery groups by alertstate, so remove any user-supplied alertstate matcher.
  const cleanFilter = cleanAlertStateFilter(filter);

  const queryRunner = useQueryRunner({
    queries: [summaryChartQuery(cleanFilter)],
  });

  // See collapseByAlertstateTransformation for why this is needed.
  const dataProvider = useDataTransformer({
    data: queryRunner,
    transformations: [collapseByAlertstateTransformation, sortByAlertState],
  });

  return <VizPanel title="" viz={summaryChartVizConfig} dataProvider={dataProvider} hoverHeader={true} />;
}

// simple wrapper so we can render the Chart using a Scene parent
export class SummaryChartScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryChartReact;
}
