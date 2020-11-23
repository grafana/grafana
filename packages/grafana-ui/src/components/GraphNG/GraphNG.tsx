import React, { useMemo, useRef } from 'react';
import {
  DataFrame,
  FieldConfig,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  getFieldDisplayName,
  getTimeField,
} from '@grafana/data';
import { mergeTimeSeriesData } from './utils';
import { UPlotChart } from '../uPlot/Plot';
import { PlotProps } from '../uPlot/types';
import { AxisPlacement, getUPlotSideFromAxis, GraphFieldConfig, GraphMode, PointMode } from '../uPlot/config';
import { useTheme } from '../../themes';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, LegendItem, LegendOptions } from '../Legend/Legend';
import { GraphLegend } from '../Graph/GraphLegend';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

interface GraphNGProps extends Omit<PlotProps, 'data' | 'config'> {
  data: DataFrame[];
  legend?: LegendOptions;
}

const defaultConfig: GraphFieldConfig = {
  mode: GraphMode.Line,
  points: PointMode.Auto,
  axisPlacement: AxisPlacement.Auto,
};

export const GraphNG: React.FC<GraphNGProps> = ({
  data,
  children,
  width,
  height,
  legend,
  timeRange,
  timeZone,
  ...plotProps
}) => {
  const theme = useTheme();
  const alignedFrameWithGapTest = useMemo(() => mergeTimeSeriesData(data), [data]);
  const legendItemsRef = useRef<LegendItem[]>([]);
  const hasLegend = legend && legend.displayMode !== LegendDisplayMode.Hidden;

  if (alignedFrameWithGapTest == null) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const alignedFrame = alignedFrameWithGapTest.frame;

  const configBuilder = useMemo(() => {
    const builder = new UPlotConfigBuilder();

    let { timeIndex } = getTimeField(alignedFrame);

    if (timeIndex === undefined) {
      timeIndex = 0; // assuming first field represents x-domain
      builder.addScale({
        scaleKey: 'x',
      });
    } else {
      builder.addScale({
        scaleKey: 'x',
        isTime: true,
      });
    }

    builder.addAxis({
      scaleKey: 'x',
      isTime: true,
      side: getUPlotSideFromAxis(AxisPlacement.Bottom),
      timeZone,
      theme,
    });

    let seriesIdx = 0;
    const legendItems: LegendItem[] = [];
    let hasLeftAxis = false;
    let hasYAxis = false;

    for (let i = 0; i < alignedFrame.fields.length; i++) {
      const field = alignedFrame.fields[i];
      const config = field.config as FieldConfig<GraphFieldConfig>;
      const customConfig = config.custom || defaultConfig;

      if (i === timeIndex || field.type !== FieldType.number) {
        continue;
      }

      const fmt = field.display ?? defaultFormatter;
      const scale = config.unit || '__fixed';
      const side = customConfig.axisPlacement ?? (hasLeftAxis ? AxisPlacement.Right : AxisPlacement.Left);

      if (!builder.hasScale(scale) && customConfig.axisPlacement !== AxisPlacement.Hidden) {
        if (side === AxisPlacement.Left) {
          hasLeftAxis = true;
        }

        builder.addScale({ scaleKey: scale });
        builder.addAxis({
          scaleKey: scale,
          label: customConfig.axisLabel,
          side: getUPlotSideFromAxis(side),
          grid: !hasYAxis,
          formatValue: v => formattedValueToString(fmt(v)),
          theme,
        });
        hasYAxis = true;
      }

      // need to update field state here because we use a transform to merge framesP
      field.state = { ...field.state, seriesIndex: seriesIdx };

      const colorMode = getFieldColorModeForField(field);
      const seriesColor = colorMode.getCalculator(field, theme)(0, 0);

      builder.addSeries({
        scaleKey: scale,
        line: (customConfig.mode ?? GraphMode.Line) === GraphMode.Line,
        lineColor: seriesColor,
        lineWidth: customConfig.lineWidth,
        points: customConfig.points !== PointMode.Never,
        pointSize: customConfig.pointRadius,
        pointColor: seriesColor,
        fill: customConfig.fillAlpha !== undefined,
        fillOpacity: customConfig.fillAlpha,
        fillColor: seriesColor,
      });

      if (hasLegend) {
        legendItems.push({
          color: seriesColor,
          label: getFieldDisplayName(field, alignedFrame),
          yAxis: side === AxisPlacement.Right ? 3 : 1,
        });
      }

      seriesIdx++;
    }

    legendItemsRef.current = legendItems;
    return builder;
  }, [alignedFrameWithGapTest, hasLegend]);

  let legendElement: React.ReactElement | undefined;

  if (hasLegend && legendItemsRef.current.length > 0) {
    legendElement = (
      <VizLayout.Legend position={legend!.placement} maxHeight="35%" maxWidth="60%">
        <GraphLegend placement={legend!.placement} items={legendItemsRef.current} displayMode={legend!.displayMode} />
      </VizLayout.Legend>
    );
  }

  return (
    <VizLayout width={width} height={height} legend={legendElement}>
      {(vizWidth: number, vizHeight: number) => (
        <UPlotChart
          data={alignedFrameWithGapTest}
          config={configBuilder}
          width={vizWidth}
          height={vizHeight}
          timeRange={timeRange}
          timeZone={timeZone}
          {...plotProps}
        >
          {children}
        </UPlotChart>
      )}
    </VizLayout>
  );
};
