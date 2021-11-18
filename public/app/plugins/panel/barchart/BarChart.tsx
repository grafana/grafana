import React, { useRef } from 'react';
import { cloneDeep } from 'lodash';
import { DataFrame, FieldType, TimeRange } from '@grafana/data';
import { GraphNG, GraphNGProps, PlotLegend, UPlotConfigBuilder, usePanelContext, useTheme2 } from '@grafana/ui';
import { LegendDisplayMode } from '@grafana/schema';
import { BarChartOptions } from './types';
import { isLegendOrdered, preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { PropDiffFn } from '../../../../../packages/grafana-ui/src/components/GraphNG/GraphNG';

/**
 * @alpha
 */
export interface BarChartProps
  extends BarChartOptions,
    Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend' | 'theme'> {}

const propsToDiff: Array<string | PropDiffFn> = [
  'orientation',
  'barWidth',
  'xTickLabelRotation',
  'xTickLabelMaxLength',
  'groupWidth',
  'stacking',
  'showValue',
  'legend',
  (prev: BarChartProps, next: BarChartProps) => next.text?.valueSize === prev.text?.valueSize,
];

export const BarChart: React.FC<BarChartProps> = (props) => {
  const theme = useTheme2();
  const { eventBus } = usePanelContext();

  const frame0Ref = useRef<DataFrame>();
  frame0Ref.current = props.frames[0];

  const renderLegend = (config: UPlotConfigBuilder) => {
    if (!config || props.legend.displayMode === LegendDisplayMode.Hidden) {
      return null;
    }

    return <PlotLegend data={props.frames} config={config} maxHeight="35%" maxWidth="60%" {...props.legend} />;
  };

  const rawValue = (seriesIdx: number, valueIdx: number) => {
    // When sorted by legend state.seriesIndex is not changed and is not equal to the sorted index of the field
    if (isLegendOrdered(props.legend)) {
      return frame0Ref.current!.fields[seriesIdx].values.get(valueIdx);
    }

    let field = frame0Ref.current!.fields.find(
      (f) => f.type === FieldType.number && f.state?.seriesIndex === seriesIdx - 1
    );
    return field!.values.get(valueIdx);
  };

  const prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
    const {
      timeZone,
      orientation,
      barWidth,
      showValue,
      groupWidth,
      stacking,
      legend,
      tooltip,
      text,
      xTickLabelRotation,
      xTickLabelMaxLength,
    } = props;

    return preparePlotConfigBuilder({
      frame: alignedFrame,
      getTimeRange,
      theme,
      timeZone,
      eventBus,
      orientation,
      barWidth,
      showValue,
      groupWidth,
      xTickLabelRotation,
      xTickLabelMaxLength,
      stacking,
      legend,
      tooltip,
      text,
      rawValue,
      allFrames: props.frames,
    });
  };

  return (
    <GraphNG
      // My heart is bleeding with the clone deep here, but nested options...
      {...cloneDeep(props)}
      theme={theme}
      frames={props.frames}
      prepConfig={prepConfig}
      propsToDiff={propsToDiff}
      preparePlotFrame={preparePlotFrame}
      renderLegend={renderLegend}
    />
  );
};
BarChart.displayName = 'BarChart';
