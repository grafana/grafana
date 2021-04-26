import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Portal } from '../../Portal/Portal';
import { usePlotContext } from '../context';
import {
  CartesianCoords2D,
  DataFrame,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  TimeZone,
} from '@grafana/data';
import { SeriesTable, SeriesTableRowProps, TooltipDisplayMode, VizTooltipContainer } from '../../VizTooltip';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';
import { pluginLog } from '../utils';

interface TooltipPluginProps {
  mode?: TooltipDisplayMode;
  timeZone: TimeZone;
  data: DataFrame;
  config: UPlotConfigBuilder;
}

/**
 * @alpha
 */
export const TooltipPlugin: React.FC<TooltipPluginProps> = ({
  mode = TooltipDisplayMode.Single,
  timeZone,
  config,
  ...otherProps
}) => {
  const plotContext = usePlotContext();
  const plotCanvas = useRef<HTMLDivElement>();
  const plotCanvasBBox = useRef<any>({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
  const [focusedSeriesIdx, setFocusedSeriesIdx] = useState<number | null>(null);
  const [focusedPointIdx, setFocusedPointIdx] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ viewport: CartesianCoords2D; plotCanvas: CartesianCoords2D } | null>(null);

  // Debug logs
  useEffect(() => {
    pluginLog('TooltipPlugin', true, `Focused series: ${focusedSeriesIdx}, focused point: ${focusedPointIdx}`);
  }, [focusedPointIdx, focusedSeriesIdx]);

  // Add uPlot hooks to the config, or re-add when the config changed
  useLayoutEffect(() => {
    const onMouseCapture = (e: MouseEvent) => {
      setCoords({
        plotCanvas: {
          x: e.clientX - plotCanvasBBox.current.left,
          y: e.clientY - plotCanvasBBox.current.top,
        },
        viewport: {
          x: e.clientX,
          y: e.clientY,
        },
      });
    };

    config.addHook('init', (u) => {
      const canvas = u.root.querySelector<HTMLDivElement>('.u-over');
      plotCanvas.current = canvas || undefined;
      plotCanvas.current?.addEventListener('mousemove', onMouseCapture);
      plotCanvas.current?.addEventListener('mouseleave', () => {});
    });

    config.addHook('setCursor', (u) => {
      setFocusedPointIdx(u.cursor.idx === undefined ? null : u.cursor.idx);
    });
    config.addHook('setSeries', (_, idx) => {
      setFocusedSeriesIdx(idx);
    });
  }, [config]);

  if (!plotContext.getPlotInstance() || focusedPointIdx === null) {
    return null;
  }

  // GraphNG expects aligned data, let's take field 0 as x field. FTW
  let xField = otherProps.data.fields[0];
  if (!xField) {
    return null;
  }
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone });
  let tooltip = null;

  const xVal = xFieldFmt(xField!.values.get(focusedPointIdx)).text;

  // when interacting with a point in single mode
  if (mode === TooltipDisplayMode.Single && focusedSeriesIdx !== null) {
    const field = otherProps.data.fields[focusedSeriesIdx];
    const plotSeries = plotContext.getSeries();

    const fieldFmt = field.display || getDisplayProcessor({ field, timeZone });
    const value = fieldFmt(plotContext.data[focusedSeriesIdx!][focusedPointIdx]);

    tooltip = (
      <SeriesTable
        series={[
          {
            // TODO: align with uPlot typings
            color: (plotSeries[focusedSeriesIdx!].stroke as any)(),
            label: getFieldDisplayName(field, otherProps.data),
            value: value ? formattedValueToString(value) : null,
          },
        ]}
        timestamp={xVal}
      />
    );
  }

  if (mode === TooltipDisplayMode.Multi) {
    let series: SeriesTableRowProps[] = [];
    const plotSeries = plotContext.getSeries();

    for (let i = 0; i < plotSeries.length; i++) {
      const frame = otherProps.data;
      const field = frame.fields[i];
      if (
        field === xField ||
        field.type === FieldType.time ||
        field.type !== FieldType.number ||
        field.config.custom?.hideFrom?.tooltip
      ) {
        continue;
      }

      const value = field.display!(plotContext.data[i][focusedPointIdx]);

      series.push({
        // TODO: align with uPlot typings
        color: (plotSeries[i].stroke as any)!(),
        label: getFieldDisplayName(field, frame),
        value: value ? formattedValueToString(value) : null,
        isActive: focusedSeriesIdx === i,
      });
    }

    tooltip = <SeriesTable series={series} timestamp={xVal} />;
  }

  if (!tooltip || !coords) {
    return null;
  }

  return (
    <Portal>
      <VizTooltipContainer position={{ x: coords.viewport.x, y: coords.viewport.y }} offset={{ x: 10, y: 10 }}>
        {tooltip}
      </VizTooltipContainer>
    </Portal>
  );
};
