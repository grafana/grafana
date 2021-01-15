import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
  compareDataFrameStructures,
  DataFrame,
  DisplayValue,
  FieldConfig,
  FieldMatcher,
  fieldReducers,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  getFieldDisplayName,
  reduceField,
  TimeRange,
} from '@grafana/data';
import { alignDataFrames } from './utils';
import { useTheme } from '../../themes';
import { UPlotChart } from '../uPlot/Plot';
import { PlotProps } from '../uPlot/types';
import { AxisPlacement, DrawStyle, GraphFieldConfig, PointVisibility } from '../uPlot/config';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, VizLegendItem, VizLegendOptions } from '../VizLegend/types';
import { VizLegend } from '../VizLegend/VizLegend';
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
  legend: VizLegendOptions;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
}

const defaultConfig: GraphFieldConfig = {
  drawStyle: DrawStyle.Line,
  showPoints: PointVisibility.Auto,
  axisPlacement: AxisPlacement.Auto,
};

export const FIXED_UNIT = '__fixed';

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
  onSeriesColorChange,
  ...plotProps
}) => {
  const theme = useTheme();
  const hasLegend = useRef(legend && legend.displayMode !== LegendDisplayMode.Hidden);

  const alignedFrameWithGapTest = useMemo(() => alignDataFrames(data, fields), [data, fields]);
  const alignedFrame = alignedFrameWithGapTest?.frame;
  const getDataFrameFieldIndex = alignedFrameWithGapTest?.getDataFrameFieldIndex;

  const compareFrames = useCallback((a?: DataFrame | null, b?: DataFrame | null) => {
    if (a && b) {
      return compareDataFrameStructures(a, b);
    }
    return false;
  }, []);

  const onLabelClick = useCallback(
    (legend: VizLegendItem, event: React.MouseEvent) => {
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

  // reference change will not trigger re-render
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

    // X is the first field in the aligned frame
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
      const scaleKey = config.unit || FIXED_UNIT;
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
      const dataFrameFieldIndex = getDataFrameFieldIndex ? getDataFrameFieldIndex(i) : undefined;

      builder.addSeries({
        scaleKey,
        drawStyle: customConfig.drawStyle!,
        lineColor: customConfig.lineColor ?? seriesColor,
        lineWidth: customConfig.lineWidth,
        lineInterpolation: customConfig.lineInterpolation,
        lineStyle: customConfig.lineStyle,
        showPoints,
        pointSize: customConfig.pointSize,
        pointColor: customConfig.pointColor ?? seriesColor,
        fillOpacity: customConfig.fillOpacity,
        spanNulls: customConfig.spanNulls || false,
        show: !customConfig.hideFrom?.graph,
        fillGradient: customConfig.fillGradient,

        // The following properties are not used in the uPlot config, but are utilized as transport for legend config
        dataFrameFieldIndex,
        fieldName: getFieldDisplayName(field, alignedFrame),
        hideInLegend: customConfig.hideFrom?.legend,
      });
    }
    return builder;
  }, [configRev, timeZone]);

  if (alignedFrameWithGapTest == null) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const legendItems = configBuilder
    .getSeries()
    .map<VizLegendItem | undefined>(s => {
      const seriesConfig = s.props;
      const fieldIndex = seriesConfig.dataFrameFieldIndex;
      const axisPlacement = configBuilder.getAxisPlacement(s.props.scaleKey);

      if (seriesConfig.hideInLegend || !fieldIndex) {
        return undefined;
      }

      const field = data[fieldIndex.frameIndex]?.fields[fieldIndex.fieldIndex];

      // Hackish: when the data prop and config builder are not in sync yet
      if (!field) {
        return undefined;
      }

      return {
        disabled: !seriesConfig.show ?? false,
        fieldIndex,
        color: seriesConfig.lineColor!,
        label: seriesConfig.fieldName,
        yAxis: axisPlacement === AxisPlacement.Left ? 1 : 2,
        getDisplayValues: () => {
          const fmt = field.display ?? defaultFormatter;
          const fieldCalcs = reduceField({
            field,
            reducers: legend.calcs,
          });

          return legend.calcs.map<DisplayValue>(reducer => {
            return {
              ...fmt(fieldCalcs[reducer]),
              title: fieldReducers.get(reducer).name,
            };
          });
        },
      };
    })
    .filter(i => i !== undefined) as VizLegendItem[];

  let legendElement: React.ReactElement | undefined;

  if (hasLegend && legendItems.length > 0) {
    legendElement = (
      <VizLayout.Legend position={legend.placement} maxHeight="35%" maxWidth="60%">
        <VizLegend
          onLabelClick={onLabelClick}
          placement={legend.placement}
          items={legendItems}
          displayMode={legend.displayMode}
          onSeriesColorChange={onSeriesColorChange}
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
