import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
  compareDataFrameStructures,
  DataFrame,
  DisplayValue,
  FieldConfig,
  FieldMatcher,
  FieldMatcherID,
  fieldMatchers,
  fieldReducers,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  outerJoinDataFrames,
  reduceField,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { useTheme } from '../../themes';
import { UPlotChart } from '../uPlot/Plot';
import {
  AxisPlacement,
  DrawStyle,
  GraphFieldConfig,
  PointVisibility,
  ScaleDirection,
  ScaleOrientation,
} from '../uPlot/config';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, VizLegendItem, VizLegendOptions } from '../VizLegend/types';
import { VizLegend } from '../VizLegend/VizLegend';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { useRevision } from '../uPlot/hooks';
import { getFieldColorModeForField, getFieldSeriesColor } from '@grafana/data';
import { GraphNGLegendEvent, GraphNGLegendEventMode } from './types';
import { isNumber } from 'lodash';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

export interface XYFieldMatchers {
  x: FieldMatcher; // first match
  y: FieldMatcher;
}

export interface GraphNGProps {
  width: number;
  height: number;
  data: DataFrame[];
  timeRange: TimeRange;
  legend: VizLegendOptions;
  timeZone: TimeZone;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
  children?: React.ReactNode;
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

  const frame = useMemo(() => {
    // Default to timeseries config
    if (!fields) {
      fields = {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      };
    }
    return outerJoinDataFrames({ frames: data, joinBy: fields.x, keep: fields.y, keepOriginIndices: true });
  }, [data, fields]);

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

  const configRev = useRevision(frame, compareFrames);

  const configBuilder = useMemo(() => {
    const builder = new UPlotConfigBuilder();

    if (!frame) {
      return builder;
    }

    // X is the first field in the aligned frame
    const xField = frame.fields[0];
    let seriesIndex = 0;

    if (xField.type === FieldType.time) {
      builder.addScale({
        scaleKey: 'x',
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
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
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
      });

      builder.addAxis({
        scaleKey: 'x',
        placement: AxisPlacement.Bottom,
        theme,
      });
    }
    let indexByName: Map<string, number> | undefined = undefined;

    for (let i = 0; i < frame.fields.length; i++) {
      const field = frame.fields[i];
      const config = field.config as FieldConfig<GraphFieldConfig>;
      const customConfig: GraphFieldConfig = {
        ...defaultConfig,
        ...config.custom,
      };

      if (field === xField || field.type !== FieldType.number) {
        continue;
      }
      field.state!.seriesIndex = seriesIndex++;

      const fmt = field.display ?? defaultFormatter;
      const scaleKey = config.unit || FIXED_UNIT;
      const colorMode = getFieldColorModeForField(field);
      const scaleColor = getFieldSeriesColor(field, theme);
      const seriesColor = scaleColor.color;

      // The builder will manage unique scaleKeys and combine where appropriate
      builder.addScale({
        scaleKey,
        orientation: ScaleOrientation.Vertical,
        direction: ScaleDirection.Up,
        distribution: customConfig.scaleDistribution?.type,
        log: customConfig.scaleDistribution?.log,
        min: field.config.min,
        max: field.config.max,
        softMin: customConfig.axisSoftMin,
        softMax: customConfig.axisSoftMax,
      });

      if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
        builder.addAxis({
          scaleKey,
          label: customConfig.axisLabel,
          size: customConfig.axisWidth,
          placement: customConfig.axisPlacement ?? AxisPlacement.Auto,
          formatValue: (v) => formattedValueToString(fmt(v)),
          theme,
        });
      }

      const showPoints = customConfig.drawStyle === DrawStyle.Points ? PointVisibility.Always : customConfig.showPoints;

      let { fillOpacity } = customConfig;
      if (customConfig.fillBelowTo) {
        if (!indexByName) {
          indexByName = getNamesToFieldIndex(frame);
        }
        const t = indexByName.get(getFieldDisplayName(field, frame));
        const b = indexByName.get(customConfig.fillBelowTo);
        if (isNumber(b) && isNumber(t)) {
          builder.addBand({
            series: [t, b],
            fill: null as any, // using null will have the band use fill options from `t`
          });
        }
        if (!fillOpacity) {
          fillOpacity = 35; // default from flot
        }
      }

      builder.addSeries({
        scaleKey,
        showPoints,
        colorMode,
        fillOpacity,
        theme,
        drawStyle: customConfig.drawStyle!,
        lineColor: customConfig.lineColor ?? seriesColor,
        lineWidth: customConfig.lineWidth,
        lineInterpolation: customConfig.lineInterpolation,
        lineStyle: customConfig.lineStyle,
        pointSize: customConfig.pointSize,
        pointColor: customConfig.pointColor ?? seriesColor,
        spanNulls: customConfig.spanNulls || false,
        show: !customConfig.hideFrom?.graph,
        gradientMode: customConfig.gradientMode,
        thresholds: config.thresholds,

        // The following properties are not used in the uPlot config, but are utilized as transport for legend config
        dataFrameFieldIndex: field.state?.origin,
        fieldName: getFieldDisplayName(field, frame),
        hideInLegend: customConfig.hideFrom?.legend,
      });
    }
    return builder;
  }, [configRev, timeZone]);

  if (!frame) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const legendItems = configBuilder
    .getSeries()
    .map<VizLegendItem | undefined>((s) => {
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
          if (!legend.calcs?.length) {
            return [];
          }

          const fmt = field.display ?? defaultFormatter;
          const fieldCalcs = reduceField({
            field,
            reducers: legend.calcs,
          });

          return legend.calcs.map<DisplayValue>((reducer) => {
            return {
              ...fmt(fieldCalcs[reducer]),
              title: fieldReducers.get(reducer).name,
            };
          });
        },
      };
    })
    .filter((i) => i !== undefined) as VizLegendItem[];

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
          data={frame}
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

function getNamesToFieldIndex(frame: DataFrame): Map<string, number> {
  const names = new Map<string, number>();
  for (let i = 0; i < frame.fields.length; i++) {
    names.set(getFieldDisplayName(frame.fields[i], frame), i);
  }
  return names;
}
