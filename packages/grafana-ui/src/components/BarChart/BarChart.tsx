import React, { useCallback, useMemo, useRef } from 'react';
import {
  compareDataFrameStructures,
  DataFrame,
  DefaultTimeZone,
  formattedValueToString,
  getFieldDisplayName,
  getFieldSeriesColor,
  getFieldColorModeForField,
  TimeRange,
  VizOrientation,
  fieldReducers,
  reduceField,
  DisplayValue,
} from '@grafana/data';

import { VizLayout } from '../VizLayout/VizLayout';
import { Themeable } from '../../types';
import { useRevision } from '../uPlot/hooks';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation } from '../uPlot/config';
import { useTheme } from '../../themes';
import { GraphNGLegendEvent, GraphNGLegendEventMode } from '../GraphNG/types';
import { FIXED_UNIT } from '../GraphNG/GraphNG';
import { LegendDisplayMode, VizLegendItem } from '../VizLegend/types';
import { VizLegend } from '../VizLegend/VizLegend';

import { BarChartFieldConfig, BarChartOptions, BarValueVisibility, defaultBarChartFieldConfig } from './types';
import { BarsOptions, getConfig } from './bars';

/**
 * @alpha
 */
export interface Props extends Themeable, BarChartOptions {
  height: number;
  width: number;
  data: DataFrame;
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
}

/**
 * @alpha
 */
export const BarChart: React.FunctionComponent<Props> = ({
  width,
  height,
  data,
  orientation,
  groupWidth,
  barWidth,
  showValue,
  legend,
  onLegendClick,
  onSeriesColorChange,
  ...plotProps
}) => {
  if (!data || data.fields.length < 2) {
    return <div>Missing data</div>;
  }

  // dominik? TODO? can this all be moved into `useRevision`
  const compareFrames = useCallback((a?: DataFrame | null, b?: DataFrame | null) => {
    if (a && b) {
      return compareDataFrameStructures(a, b);
    }
    return false;
  }, []);

  const configRev = useRevision(data, compareFrames);

  const theme = useTheme();

  // Updates only when the structure changes
  const configBuilder = useMemo(() => {
    if (!orientation || orientation === VizOrientation.Auto) {
      orientation = width < height ? VizOrientation.Horizontal : VizOrientation.Vertical;
    }

    // bar orientation -> x scale orientation & direction
    let xOri: ScaleOrientation, xDir: ScaleDirection, yOri: ScaleOrientation, yDir: ScaleDirection;

    if (orientation === VizOrientation.Vertical) {
      xOri = ScaleOrientation.Horizontal;
      xDir = ScaleDirection.Right;
      yOri = ScaleOrientation.Vertical;
      yDir = ScaleDirection.Up;
    } else {
      xOri = ScaleOrientation.Vertical;
      xDir = ScaleDirection.Down;
      yOri = ScaleOrientation.Horizontal;
      yDir = ScaleDirection.Right;
    }

    const formatValue =
      showValue !== BarValueVisibility.Never
        ? (seriesIdx: number, value: any) => formattedValueToString(data.fields[seriesIdx].display!(value))
        : undefined;

    // Use bar width when only one field
    if (data.fields.length === 2) {
      groupWidth = barWidth;
      barWidth = 1;
    }

    const opts: BarsOptions = {
      xOri,
      xDir,
      groupWidth,
      barWidth,
      formatValue,
      onHover: (seriesIdx: number, valueIdx: number) => {
        console.log('hover', { seriesIdx, valueIdx });
      },
      onLeave: (seriesIdx: number, valueIdx: number) => {
        console.log('leave', { seriesIdx, valueIdx });
      },
    };
    const config = getConfig(opts);

    const builder = new UPlotConfigBuilder();

    builder.addHook('init', config.init);
    builder.addHook('drawClear', config.drawClear);
    builder.addHook('setCursor', config.setCursor);

    builder.setCursor(config.cursor);
    builder.setSelect(config.select);

    builder.addScale({
      scaleKey: 'x',
      isTime: false,
      distribution: ScaleDistribution.Ordinal,
      orientation: xOri,
      direction: xDir,
    });

    builder.addAxis({
      scaleKey: 'x',
      isTime: false,
      placement: xOri === 0 ? AxisPlacement.Bottom : AxisPlacement.Left,
      splits: config.xSplits,
      values: config.xValues,
      grid: false,
      ticks: false,
      gap: 15,
      theme,
    });

    let seriesIndex = 0;

    // iterate the y values
    for (let i = 1; i < data.fields.length; i++) {
      const field = data.fields[i];

      field.state!.seriesIndex = seriesIndex++;

      const customConfig: BarChartFieldConfig = { ...defaultBarChartFieldConfig, ...field.config.custom };

      const scaleKey = field.config.unit || FIXED_UNIT;
      const colorMode = getFieldColorModeForField(field);
      const scaleColor = getFieldSeriesColor(field, theme);
      const seriesColor = scaleColor.color;

      builder.addSeries({
        scaleKey,
        lineWidth: customConfig.lineWidth,
        lineColor: seriesColor,
        fillOpacity: customConfig.fillOpacity,
        theme,
        colorMode,
        pathBuilder: config.drawBars,
        pointsBuilder: config.drawPoints,
        show: !customConfig.hideFrom?.graph,
        gradientMode: customConfig.gradientMode,
        thresholds: field.config.thresholds,

        /*
          lineColor: customConfig.lineColor ?? seriesColor,
          lineWidth: customConfig.lineWidth,
          lineStyle: customConfig.lineStyle,
          */

        // The following properties are not used in the uPlot config, but are utilized as transport for legend config
        dataFrameFieldIndex: {
          fieldIndex: i,
          frameIndex: 0,
        },
        fieldName: getFieldDisplayName(field, data),
        hideInLegend: customConfig.hideFrom?.legend,
      });

      // The builder will manage unique scaleKeys and combine where appropriate
      builder.addScale({
        scaleKey,
        min: field.config.min,
        max: field.config.max,
        softMin: customConfig.axisSoftMin,
        softMax: customConfig.axisSoftMax,
        orientation: yOri,
        direction: yDir,
      });

      if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
        let placement = customConfig.axisPlacement;
        if (!placement || placement === AxisPlacement.Auto) {
          placement = AxisPlacement.Left;
        }
        if (xOri === 1) {
          if (placement === AxisPlacement.Left) {
            placement = AxisPlacement.Bottom;
          }
          if (placement === AxisPlacement.Right) {
            placement = AxisPlacement.Top;
          }
        }

        builder.addAxis({
          scaleKey,
          label: customConfig.axisLabel,
          size: customConfig.axisWidth,
          placement,
          formatValue: (v) => formattedValueToString(field.display!(v)),
          theme,
        });
      }
    }

    return builder;
  }, [data, configRev, orientation, width, height]);

  const onLabelClick = useCallback(
    (legend: VizLegendItem, event: React.MouseEvent) => {
      const { fieldIndex } = legend;

      if (!onLegendClick || !fieldIndex) {
        return;
      }

      onLegendClick({
        fieldIndex,
        mode: GraphNGLegendEventMode.AppendToSelection,
      });
    },
    [onLegendClick, data]
  );

  const hasLegend = useRef(legend && legend.displayMode !== LegendDisplayMode.Hidden);

  const legendItems = configBuilder
    .getSeries()
    .map<VizLegendItem | undefined>((s) => {
      const seriesConfig = s.props;
      const fieldIndex = seriesConfig.dataFrameFieldIndex;
      if (seriesConfig.hideInLegend || !fieldIndex) {
        return undefined;
      }

      const field = data.fields[fieldIndex.fieldIndex];
      if (!field) {
        return undefined;
      }

      return {
        disabled: !seriesConfig.show ?? false,
        fieldIndex,
        color: seriesConfig.lineColor!,
        label: seriesConfig.fieldName,
        yAxis: 1,
        getDisplayValues: () => {
          if (!legend.calcs?.length) {
            return [];
          }

          const fieldCalcs = reduceField({
            field,
            reducers: legend.calcs,
          });

          return legend.calcs.map<DisplayValue>((reducer) => {
            return {
              ...field.display!(fieldCalcs[reducer]),
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
          data={data}
          config={configBuilder}
          width={vizWidth}
          height={vizHeight}
          timeRange={({ from: 1, to: 1 } as unknown) as TimeRange} // HACK
          timeZone={DefaultTimeZone}
        />
      )}
    </VizLayout>
  );
};
