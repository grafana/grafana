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
import { AxisPlacement, DrawStyle, GraphFieldConfig, PointVisibility } from '../uPlot/config';
import { useTheme } from '../../themes';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, LegendItem, LegendOptions } from '../Legend/Legend';
import { GraphLegend } from '../Graph/GraphLegend';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { useRevision } from '../uPlot/hooks';
import { GraphNGLegendEvent, GraphNGLegendEventMode } from './types';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

export interface XYFieldMatchers {
  x: FieldMatcher;
  y: FieldMatcher;
}
export interface GraphNGProps extends Omit<PlotProps, 'data' | 'config'> {
  data: DataFrame[];
  legend?: LegendOptions;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
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
  onLegendClick,
  ...plotProps
}) => {
  const alignedFrameWithGapTest = useMemo(() => alignDataFrames(data, fields), [data, fields]);
  const theme = useTheme();
  const legendItemsRef = useRef<LegendItem[]>([]);
  const hasLegend = useRef(legend && legend.displayMode !== LegendDisplayMode.Hidden);
  const alignedFrame = alignedFrameWithGapTest?.frame;
  const getDataFrameFieldIndex = alignedFrameWithGapTest?.getDataFrameFieldIndex;

  const compareFrames = useCallback((a?: DataFrame | null, b?: DataFrame | null) => {
    if (a && b) {
      return compareDataFrameStructures(a, b);
    }
    return false;
  }, []);

  const onLabelClick = useCallback(
    (legend: LegendItem, event: React.MouseEvent) => {
      const { fieldIndex } = legend;

      if (!onLegendClick || !fieldIndex) {
        return;
      }

      onLegendClick({
        fieldIndex,
        mode: mapMouseEventToMode(event),
      });
    },
    [onLegendClick, data]
  );

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
      const colorMode = getFieldColorModeForField(field);
      const seriesColor = colorMode.getCalculator(field, theme)(0, 0);

      if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
        // The builder will manage unique scaleKeys and combine where appropriate
        builder.addScale({
          scaleKey,
          distribution: customConfig.scaleDistribution?.type,
          log: customConfig.scaleDistribution?.log,
          min: field.config.min,
          max: field.config.max,
        });

        builder.addAxis({
          scaleKey,
          label: customConfig.axisLabel,
          size: customConfig.axisWidth,
          placement: customConfig.axisPlacement ?? AxisPlacement.Auto,
          formatValue: v => formattedValueToString(fmt(v)),
          theme,
        });
      }

      const showPoints = customConfig.drawStyle === DrawStyle.Points ? PointVisibility.Always : customConfig.showPoints;

      builder.addSeries({
        scaleKey,
        drawStyle: customConfig.drawStyle!,
        lineColor: customConfig.lineColor ?? seriesColor,
        lineWidth: customConfig.lineWidth,
        lineInterpolation: customConfig.lineInterpolation,
        showPoints,
        pointSize: customConfig.pointSize,
        pointColor: customConfig.pointColor ?? seriesColor,
        fillOpacity: customConfig.fillOpacity,
        spanNulls: customConfig.spanNulls || false,
        show: !customConfig.hideFrom?.graph,
        fillGradient: customConfig.fillGradient,
      });

      if (hasLegend.current && !customConfig.hideFrom?.legend) {
        const axisPlacement = builder.getAxisPlacement(scaleKey);
        // we need to add this as dep or move it to be done outside.
        const dataFrameFieldIndex = getDataFrameFieldIndex ? getDataFrameFieldIndex(i) : undefined;

        legendItems.push({
          disabled: field.config.custom?.hideFrom?.graph ?? false,
          fieldIndex: dataFrameFieldIndex,
          color: seriesColor,
          label: getFieldDisplayName(field, alignedFrame),
          yAxis: axisPlacement === AxisPlacement.Left ? 1 : 2,
        });
      }
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
        <GraphLegend
          onLabelClick={onLabelClick}
          placement={legend!.placement}
          items={legendItemsRef.current}
          displayMode={legend!.displayMode}
        />
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

const mapMouseEventToMode = (event: React.MouseEvent): GraphNGLegendEventMode => {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return GraphNGLegendEventMode.AppendToSelection;
  }
  return GraphNGLegendEventMode.ToggleSelection;
};
