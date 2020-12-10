import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
  compareDataFrameStructures,
  DataFrame,
  FieldConfig,
  FieldMatcher,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  getFieldDisplayName,
  TimeRange,
} from '@grafana/data';
import { alignDataFrames } from './utils';
import { UPlotChart } from '../uPlot/Plot';
import { PlotProps } from '../uPlot/types';
import { AxisPlacement, GraphFieldConfig, DrawStyle, PointVisibility } from '../uPlot/config';
import { useTheme } from '../../themes';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, LegendItem, LegendOptions } from '../Legend/Legend';
import { GraphLegend } from '../Graph/GraphLegend';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { useRevision } from '../uPlot/hooks';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

export interface XYFieldMatchers {
  x: FieldMatcher;
  y: FieldMatcher;
}

export interface GraphNGProps extends Omit<PlotProps, 'data' | 'config'> {
  data: DataFrame[];
  legend?: LegendOptions;
  fields?: XYFieldMatchers; // default will assume timeseries data
}

const defaultConfig: GraphFieldConfig = {
  drawStyle: DrawStyle.Line,
  showPoints: PointVisibility.Auto,
  axisPlacement: AxisPlacement.Auto,
};

export const GraphNG: React.FC<GraphNGProps> = ({
  data,
  fields,
  children,
  width,
  height,
  legend,
  timeRange,
  timeZone,
  ...plotProps
}) => {
  const alignedFrameWithGapTest = useMemo(() => alignDataFrames(data, fields), [data, fields]);
  const theme = useTheme();
  const legendItemsRef = useRef<LegendItem[]>([]);
  const hasLegend = useRef(legend && legend.displayMode !== LegendDisplayMode.Hidden);
  const alignedFrame = alignedFrameWithGapTest?.frame;

  const compareFrames = useCallback((a?: DataFrame | null, b?: DataFrame | null) => {
    if (a && b) {
      return compareDataFrameStructures(a, b);
    }
    return false;
  }, []);

  // reference change will not triger re-render
  const currentTimeRange = useRef<TimeRange>(timeRange);
  useLayoutEffect(() => {
    currentTimeRange.current = timeRange;
  }, [timeRange]);

  const configRev = useRevision(alignedFrame, compareFrames);

  const configBuilder = useMemo(() => {
    const builder = new UPlotConfigBuilder();

    if (!alignedFrame) {
      return builder;
    }

    // X is the first field in the alligned frame
    const xField = alignedFrame.fields[0];
    if (xField.type === FieldType.time) {
      builder.addScale({
        scaleKey: 'x',
        isTime: true,
        range: () => {
          const r = currentTimeRange.current!;
          return [r.from.valueOf(), r.to.valueOf()];
        },
      });
      builder.addAxis({
        scaleKey: 'x',
        isTime: true,
        placement: AxisPlacement.Bottom,
        timeZone,
        theme,
      });
    } else {
      // Not time!
      builder.addScale({
        scaleKey: 'x',
      });
      builder.addAxis({
        scaleKey: 'x',
        placement: AxisPlacement.Bottom,
        theme,
      });
    }

    let seriesIdx = 0;
    const legendItems: LegendItem[] = [];

    for (let i = 0; i < alignedFrame.fields.length; i++) {
      const field = alignedFrame.fields[i];
      const config = field.config as FieldConfig<GraphFieldConfig>;
      const customConfig: GraphFieldConfig = {
        ...defaultConfig,
        ...config.custom,
      };

      if (field === xField || field.type !== FieldType.number) {
        continue;
      }

      const fmt = field.display ?? defaultFormatter;
      const scaleKey = config.unit || '__fixed';

      if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
        // The builder will manage unique scaleKeys and combine where appropriate
        builder.addScale({ scaleKey, min: field.config.min, max: field.config.max });
        builder.addAxis({
          scaleKey,
          label: customConfig.axisLabel,
          size: customConfig.axisWidth,
          placement: customConfig.axisPlacement ?? AxisPlacement.Auto,
          formatValue: v => formattedValueToString(fmt(v)),
          theme,
        });
      }

      // need to update field state here because we use a transform to merge framesP
      field.state = { ...field.state, seriesIndex: seriesIdx };

      const colorMode = getFieldColorModeForField(field);
      const seriesColor = colorMode.getCalculator(field, theme)(0, 0);
      const showPoints = customConfig.drawStyle === DrawStyle.Points ? PointVisibility.Always : customConfig.showPoints;

      builder.addSeries({
        scaleKey,
        drawStyle: customConfig.drawStyle!,
        lineColor: seriesColor,
        lineWidth: customConfig.lineWidth,
        lineInterpolation: customConfig.lineInterpolation,
        showPoints,
        pointSize: customConfig.pointSize,
        pointColor: seriesColor,
        fillOpacity: customConfig.fillOpacity,
        fillColor: seriesColor,
        spanNulls: customConfig.spanNulls || false,
      });

      if (hasLegend.current) {
        const axisPlacement = builder.getAxisPlacement(scaleKey);

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
  }, [configRev, timeZone]);

  if (alignedFrameWithGapTest == null) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

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
