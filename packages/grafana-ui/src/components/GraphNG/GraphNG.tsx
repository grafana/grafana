import React, { useCallback, useMemo, useRef } from 'react';
import {
  compareDataFrameStructures,
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
import { AxisPlacement, GraphFieldConfig, GraphMode, PointMode } from '../uPlot/config';
import { useTheme } from '../../themes';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, LegendItem, LegendOptions } from '../Legend/Legend';
import { GraphLegend } from '../Graph/GraphLegend';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { useRevision } from '../uPlot/hooks';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

export interface GraphNGProps extends Omit<PlotProps, 'data' | 'config'> {
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
  const alignedFrameWithGapTest = useMemo(() => mergeTimeSeriesData(data), [data]);

  if (alignedFrameWithGapTest == null) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const theme = useTheme();
  const legendItemsRef = useRef<LegendItem[]>([]);
  const hasLegend = useRef(legend && legend.displayMode !== LegendDisplayMode.Hidden);
  const alignedFrame = alignedFrameWithGapTest.frame;
  const compareFrames = useCallback(
    (a: DataFrame, b: DataFrame) => compareDataFrameStructures(a, b, ['min', 'max']),
    []
  );
  const configRev = useRevision(alignedFrame, compareFrames);

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
      placement: AxisPlacement.Bottom,
      timeZone,
      theme,
    });

    let seriesIdx = 0;
    const legendItems: LegendItem[] = [];

    for (let i = 0; i < alignedFrame.fields.length; i++) {
      const field = alignedFrame.fields[i];
      const config = field.config as FieldConfig<GraphFieldConfig>;
      const customConfig = config.custom || defaultConfig;

      if (i === timeIndex || field.type !== FieldType.number) {
        continue;
      }

      const fmt = field.display ?? defaultFormatter;
      const scale = config.unit || '__fixed';
      const isNewScale = !builder.hasScale(scale);

      if (isNewScale && customConfig.axisPlacement !== AxisPlacement.Hidden) {
        builder.addScale({ scaleKey: scale, min: field.config.min, max: field.config.max });
        builder.addAxis({
          scaleKey: scale,
          label: customConfig.axisLabel,
          placement: customConfig.axisPlacement ?? AxisPlacement.Auto,
          formatValue: v => formattedValueToString(fmt(v)),
          theme,
        });
      }

      // need to update field state here because we use a transform to merge framesP
      field.state = { ...field.state, seriesIndex: seriesIdx };

      const colorMode = getFieldColorModeForField(field);
      const seriesColor = colorMode.getCalculator(field, theme)(0, 0);
      const pointsMode = customConfig.mode === GraphMode.Points ? PointMode.Always : customConfig.points;

      builder.addSeries({
        scaleKey: scale,
        line: (customConfig.mode ?? GraphMode.Line) === GraphMode.Line,
        lineColor: seriesColor,
        lineWidth: customConfig.lineWidth,
        points: pointsMode,
        pointSize: customConfig.pointRadius,
        pointColor: seriesColor,
        fill: customConfig.fillAlpha !== undefined,
        fillOpacity: customConfig.fillAlpha,
        fillColor: seriesColor,
      });

      if (hasLegend.current) {
        const axisPlacement = builder.getAxisPlacement(scale);

        legendItems.push({
          color: seriesColor,
          label: getFieldDisplayName(field, alignedFrame),
          yAxis: axisPlacement === AxisPlacement.Left ? 1 : 2,
        });
      }

      seriesIdx++;
    }

    legendItemsRef.current = legendItems;
    return builder;
  }, [configRev]);

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
