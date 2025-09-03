import { omit } from 'lodash';
import { useMemo } from 'react';

import { DataFrame, Labels, LoadingState, TimeRange } from '@grafana/data';
import { SceneDataNode, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel } from '@grafana/scenes-react';
import { GraphDrawStyle, VisibilityMode } from '@grafana/schema';
import { AxisPlacement, BarAlignment, LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/ui';

import { AlertLabels } from '../../components/AlertLabels';
import { overrideToFixedColor } from '../../home/Insights';
import { GroupRow } from '../GroupRow';

import { DEFAULT_FIELDS } from './utils';

interface Instance {
  labels: Labels;
  series: DataFrame[];
}

interface InstanceRowProps {
  instance: Instance;
  commonLabels: Labels;
  leftColumnWidth: number;
  timeRange: TimeRange;
}

const chartConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
  .setCustomFieldConfig('barWidthFactor', 1)
  .setCustomFieldConfig('barAlignment', BarAlignment.After)
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .setCustomFieldConfig('fillOpacity', 60)
  .setCustomFieldConfig('lineWidth', 0)
  .setCustomFieldConfig('stacking', { mode: StackingMode.None })
  .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
  .setCustomFieldConfig('axisGridShow', false)
  .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
  .setOption('legend', {
    showLegend: false,
    displayMode: LegendDisplayMode.Hidden,
  })
  .setMin(0)
  .setMax(1)
  .setOverrides((builder) =>
    builder
      .matchFieldsWithName('firing')
      .overrideColor(overrideToFixedColor('firing'))
      .matchFieldsWithName('pending')
      .overrideColor(overrideToFixedColor('pending'))
  )
  .build();

export function InstanceRow({ instance, commonLabels, leftColumnWidth, timeRange }: InstanceRowProps) {
  console.log(instance);

  const dataProvider = useMemo(
    () =>
      new SceneDataNode({
        data: {
          series: instance.series,
          state: LoadingState.Done,
          timeRange,
        },
      }),
    [instance, timeRange]
  );

  const labels = omit(instance.labels, DEFAULT_FIELDS);

  return (
    <GroupRow
      width={leftColumnWidth}
      title={<AlertLabels size="xs" labels={labels} commonLabels={commonLabels} />}
      content={
        <VizPanel title="" hoverHeader={true} viz={chartConfig} dataProvider={dataProvider} displayMode="transparent" />
      }
    />
  );
}
