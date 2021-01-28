// Library
import { BarsOptions, getConfig } from './bars';

import React, { useCallback, useMemo, useRef } from 'react';
import {
  compareDataFrameStructures,
  DataFrame,
  DefaultTimeZone,
  formattedValueToString,
  getFieldDisplayName,
  getFieldSeriesColor,
  TimeRange,
} from '@grafana/data';

import { VizLayout } from '../VizLayout/VizLayout';

// Types
import { VizOrientation } from '@grafana/data';
import { Themeable } from '../../types';
import { BarChartOptions, BarValueVisibility } from './types';
import { useRevision } from '../uPlot/hooks';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { AxisPlacement, ScaleDistribution } from '../uPlot/config';
import { useTheme } from '../../themes';
import { GraphNGLegendEvent, GraphNGLegendEventMode } from '../GraphNG/types';
import { LegendDisplayMode, VizLegendItem } from '../VizLegend/types';
import { VizLegend } from '../VizLegend/VizLegend';

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
    const xOri = orientation === VizOrientation.Horizontal ? 1 : 0;
    const xDir = orientation === VizOrientation.Horizontal ? -1 : 1;

    const formatValue =
      showValue !== BarValueVisibility.Never
        ? (seriesIdx: number, value: any) => formattedValueToString(data.fields[seriesIdx].display!(value))
        : undefined;

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

    builder.addScale({
      scaleKey: 'y',
      isTime: false,
      orientation: xOri === 0 ? 1 : 0,
      // range: config.yRange,
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

    builder.addAxis({
      scaleKey: 'y',
      isTime: false,
      placement: xOri === 0 ? AxisPlacement.Left : AxisPlacement.Bottom,
      theme,
    });

    // const FIXED_UNIT = '__fixed';

    let seriesIndex = 0;

    for (let i = 1; i < data.fields.length; i++) {
      const field = data.fields[i];

      field.state!.seriesIndex = seriesIndex++;

      // const config = field.config;
      // const customConfig = config.custom;

      // const scaleKey = config.unit || FIXED_UNIT;
      // const colorMode = getFieldColorModeForField(field);
      const scaleColor = getFieldSeriesColor(field, theme);
      const seriesColor = scaleColor.color;

      builder.addSeries({
        scaleKey: i === 0 ? 'x' : 'y',
        lineWidth: 1,
        lineColor: seriesColor,
        fillOpacity: 80,
        theme,
        fieldName: getFieldDisplayName(field, data),
        pathBuilder: config.drawBars,
        pointsBuilder: config.drawPoints,
        dataFrameFieldIndex: {
          fieldIndex: i,
          frameIndex: 0,
        },

        /*
          lineColor: customConfig.lineColor ?? seriesColor,
          lineWidth: customConfig.lineWidth,
          lineStyle: customConfig.lineStyle,
          show: !customConfig.hideFrom?.graph,
          gradientMode: customConfig.gradientMode,
          thresholds: config.thresholds,

          // The following properties are not used in the uPlot config, but are utilized as transport for legend config
          dataFrameFieldIndex,
          fieldName: getFieldDisplayName(field, alignedFrame),
          hideInLegend: customConfig.hideFrom?.legend,
        */
      });
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
      const axisPlacement = configBuilder.getAxisPlacement(s.props.scaleKey);

      if (seriesConfig.hideInLegend || !fieldIndex) {
        return undefined;
      }

      // const field = data[fieldIndex.frameIndex]?.fields[fieldIndex.fieldIndex];

      // // Hackish: when the data prop and config builder are not in sync yet
      // if (!field) {
      //   return undefined;
      // }

      return {
        disabled: !seriesConfig.show ?? false,
        fieldIndex,
        color: seriesConfig.lineColor!,
        label: seriesConfig.fieldName,
        yAxis: axisPlacement === AxisPlacement.Left ? 1 : 2,
        getDisplayValues: () => [],
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
