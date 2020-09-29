import React, { useMemo } from 'react';
import {
  Area,
  Canvas,
  colors,
  ContextMenuPlugin,
  GraphCustomFieldConfig,
  LegendDisplayMode,
  LegendPlugin,
  Line,
  Point,
  SeriesGeometry,
  Scale,
  TooltipPlugin,
  UPlotChart,
  ZoomPlugin,
} from '@grafana/ui';

import {
  FieldConfig,
  FieldType,
  formattedValueToString,
  getColorFromHexRgbOrName,
  getTimeField,
  PanelProps,
  systemDateFormats,
} from '@grafana/data';

import { Options } from './types';
import { alignAndSortDataFramesByFieldName } from './utils';
import { VizLayout } from './VizLayout';

import { Axis } from '@grafana/ui/src/components/uPlot/geometries/Axis';
import { timeFormatToTemplate } from '@grafana/ui/src/components/uPlot/utils';

interface GraphPanelProps extends PanelProps<Options> {}

const TIME_FIELD_NAME = 'Time';

const timeStampsConfig = [
  [3600 * 24 * 365, '{YYYY}', 7, '{YYYY}'],
  [3600 * 24 * 28, `{${timeFormatToTemplate(systemDateFormats.interval.month)}`, 7, '{MMM}\n{YYYY}'],
  [
    3600 * 24,
    `{${timeFormatToTemplate(systemDateFormats.interval.day)}`,
    7,
    `${timeFormatToTemplate(systemDateFormats.interval.day)}\n${timeFormatToTemplate(systemDateFormats.interval.year)}`,
  ],
  [
    3600,
    `{${timeFormatToTemplate(systemDateFormats.interval.minute)}`,
    4,
    `${timeFormatToTemplate(systemDateFormats.interval.minute)}\n${timeFormatToTemplate(
      systemDateFormats.interval.day
    )}`,
  ],
  [
    60,
    `{${timeFormatToTemplate(systemDateFormats.interval.second)}`,
    4,
    `${timeFormatToTemplate(systemDateFormats.interval.second)}\n${timeFormatToTemplate(
      systemDateFormats.interval.day
    )}`,
  ],
  [
    1,
    `:{ss}`,
    2,
    `:{ss}\n${timeFormatToTemplate(systemDateFormats.interval.day)} ${timeFormatToTemplate(
      systemDateFormats.interval.minute
    )}`,
  ],
  [
    1e-3,
    ':{ss}.{fff}',
    2,
    `:{ss}.{fff}\n${timeFormatToTemplate(systemDateFormats.interval.day)} ${timeFormatToTemplate(
      systemDateFormats.interval.minute
    )}`,
  ],
];

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

export const GraphPanel: React.FC<GraphPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  onChangeTimeRange,
}) => {
  const alignedData = useMemo(() => {
    if (!data || !data.series?.length) {
      return null;
    }
    return alignAndSortDataFramesByFieldName(data.series, TIME_FIELD_NAME);
  }, [data]);

  if (!alignedData) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }
  const geometries: React.ReactNode[] = [];
  const scales: React.ReactNode[] = [];
  const axes: React.ReactNode[] = [];

  let { timeIndex } = getTimeField(alignedData);

  if (timeIndex === undefined) {
    timeIndex = 0; // assuming first field represents x-domain
    scales.push(<Scale scaleKey="x" />);
  } else {
    scales.push(<Scale scaleKey="x" time />);
  }

  axes.push(<Axis scaleKey="x" values={timeStampsConfig} side={2} />);

  let seriesIdx = 0;
  const uniqueScales: Record<string, boolean> = {};

  for (let i = 0; i < alignedData.fields.length; i++) {
    const seriesGeometry = [];
    const field = alignedData.fields[i];
    const config = field.config as FieldConfig<GraphCustomFieldConfig>;
    const customConfig = config.custom;
    if (i === timeIndex || field.type !== FieldType.number) {
      continue;
    }
    const fmt = field.display ?? defaultFormatter;
    const scale = config.unit || '__fixed';

    if (!uniqueScales[scale]) {
      uniqueScales[scale] = true;
      scales.push(<Scale scaleKey={scale} />);
      axes.push(
        <Axis
          key={`axis-${scale}-${i}`}
          scaleKey={scale}
          label={config.custom?.axis?.label}
          size={config.custom?.axis?.width}
          side={config.custom?.axis?.side || 3}
          grid={config.custom?.axis?.grid}
          formatValue={v => formattedValueToString(fmt(v))}
        />
      );
    }

    const seriesColor =
      customConfig?.line.color && customConfig?.line.color.fixedColor
        ? getColorFromHexRgbOrName(customConfig.line.color.fixedColor)
        : colors[seriesIdx];

    if (customConfig?.line?.show) {
      seriesGeometry.push(
        <Line
          key={`line-${scale}-${i}`}
          scaleKey={scale}
          stroke={seriesColor}
          width={customConfig?.line.show ? customConfig?.line.width || 1 : 0}
        />
      );
    }

    if (customConfig?.points?.show) {
      seriesGeometry.push(
        <Point key={`point-${scale}-${i}`} scaleKey={scale} size={customConfig?.points?.radius} stroke={seriesColor} />
      );
    }

    if (customConfig?.fill?.alpha) {
      seriesGeometry.push(
        <Area key={`area-${scale}-${i}`} scaleKey={scale} fill={customConfig?.fill.alpha} color={seriesColor} />
      );
    }
    if (seriesGeometry.length > 1) {
      geometries.push(
        <SeriesGeometry key={`seriesGeometry-${scale}-${i}`} scaleKey={scale}>
          {seriesGeometry}
        </SeriesGeometry>
      );
    } else {
      geometries.push(seriesGeometry);
    }

    seriesIdx++;
  }

  return (
    <VizLayout width={width} height={height}>
      {({ builder, getLayout }) => {
        const layout = getLayout();
        // when all layout slots are ready we can calculate the canvas(actual viz) size
        const canvasSize = layout.isReady
          ? {
              width: width - (layout.left.width + layout.right.width),
              height: height - (layout.top.height + layout.bottom.height),
            }
          : { width: 0, height: 0 };

        if (options.legend.isVisible) {
          builder.addSlot(
            options.legend.placement,
            <LegendPlugin
              placement={options.legend.placement}
              displayMode={options.legend.asTable ? LegendDisplayMode.Table : LegendDisplayMode.List}
            />
          );
        } else {
          builder.clearSlot(options.legend.placement);
        }

        return (
          <UPlotChart data={alignedData} timeRange={timeRange} timeZone={timeZone} {...canvasSize}>
            {scales}
            {axes}
            {geometries}
            {builder.addSlot('canvas', <Canvas />).render()}
            <TooltipPlugin mode={options.tooltipOptions.mode as any} timeZone={timeZone} />
            <ZoomPlugin onZoom={onChangeTimeRange} />
            <ContextMenuPlugin />

            {/* TODO: */}
            {/*<AnnotationsEditorPlugin />*/}
          </UPlotChart>
        );
      }}
    </VizLayout>
  );
};
