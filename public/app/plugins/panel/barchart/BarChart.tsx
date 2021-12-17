import React, { useRef } from 'react';
import { cloneDeep } from 'lodash';
import { DataFrame, FieldType, TimeRange } from '@grafana/data';
import {
  GraphNG,
  GraphNGProps,
  PlotLegend,
  UPlotConfigBuilder,
  usePanelContext,
  useTheme2,
  VizLayout,
  VizLegend,
} from '@grafana/ui';
import { LegendDisplayMode } from '@grafana/schema';
import { BarChartDisplayValues, BarChartOptions } from './types';
import { isLegendOrdered, preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { PropDiffFn } from '../../../../../packages/grafana-ui/src/components/GraphNG/GraphNG';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { getFieldLegendItem } from '../state-timeline/utils';

/**
 * @alpha
 */
export interface BarChartProps
  extends BarChartOptions,
    Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend' | 'theme'> {
  data: BarChartDisplayValues;
}

const propsToDiff: Array<string | PropDiffFn> = [
  'orientation',
  'barWidth',
  'barRadius',
  'xTickLabelRotation',
  'xTickLabelMaxLength',
  'xTickLabelSpacing',
  'groupWidth',
  'stacking',
  'showValue',
  'colorField',
  'legend',
  (prev: BarChartProps, next: BarChartProps) => next.text?.valueSize === prev.text?.valueSize,
];

export const BarChart: React.FC<BarChartProps> = (props) => {
  const theme = useTheme2();
  const { eventBus } = usePanelContext();

  const frame0Ref = useRef<DataFrame>();
  frame0Ref.current = props.frames[0];

  const renderLegend = (config: UPlotConfigBuilder) => {
    const { legend } = props;
    if (!config || legend.displayMode === LegendDisplayMode.Hidden) {
      return null;
    }

    if (props.data.colorByField) {
      const items = getFieldLegendItem([props.data.colorByField], theme);
      if (items?.length) {
        return (
          <VizLayout.Legend placement={legend.placement}>
            <VizLegend placement={legend.placement} items={items} displayMode={legend.displayMode} />
          </VizLayout.Legend>
        );
      }
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

  // Color by value
  let getColor: ((seriesIdx: number, valueIdx: number) => string) | undefined = undefined;

  let fillOpacity = 1;

  if (props.data.colorByField) {
    const colorByField = props.data.colorByField;
    const disp = colorByField.display!;
    fillOpacity = (colorByField.config.custom.fillOpacity ?? 100) / 100;
    // gradientMode? ignore?
    getColor = (seriesIdx: number, valueIdx: number) => disp(colorByField.values.get(valueIdx)).color!;
  }

  const prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
    const {
      timeZone,
      orientation,
      barWidth,
      barRadius = 0,
      showValue,
      groupWidth,
      stacking,
      legend,
      tooltip,
      text,
      xTickLabelRotation,
      xTickLabelMaxLength,
      xTickLabelSpacing,
    } = props;

    return preparePlotConfigBuilder({
      frame: alignedFrame,
      getTimeRange,
      theme,
      timeZone,
      eventBus,
      orientation,
      barWidth,
      barRadius,
      showValue,
      groupWidth,
      xTickLabelRotation,
      xTickLabelMaxLength,
      xTickLabelSpacing,
      stacking,
      legend,
      tooltip,
      text,
      rawValue,
      getColor,
      fillOpacity,
      allFrames: props.frames,
    });
  };

  return (
    <GraphNG
      // My heart is bleeding with the clone deep here, but nested options...
      {...cloneDeep(props)}
      theme={theme}
      prepConfig={prepConfig}
      propsToDiff={propsToDiff}
      preparePlotFrame={preparePlotFrame}
      renderLegend={renderLegend}
    />
  );
};
BarChart.displayName = 'BarChart';
