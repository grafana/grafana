import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Portal } from '../../Portal/Portal';
import { css } from '@emotion/css';
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
import { useTheme2 } from '../../../themes/ThemeContext';

interface TooltipPluginProps {
  mode?: TooltipDisplayMode;
  timeZone: TimeZone;
  data: DataFrame;
  config: UPlotConfigBuilder;
  id?: string | number;
  debug?: () => boolean;
}

/**
 * @alpha
 */
export const TooltipPlugin: React.FC<TooltipPluginProps> = ({
  mode = TooltipDisplayMode.Single,
  timeZone,
  config,
  debug = () => false,
  ...otherProps
}) => {
  const theme = useTheme2();
  const plotCtx = usePlotContext();
  const [focusedSeriesIdx, setFocusedSeriesIdx] = useState<number | null>(null);
  const [focusedPointIdx, setFocusedPointIdx] = useState<number | null>(null);
  const [plotCanvasBBox, setPlotCanvasBBox] = useState<DOMRect>();
  const [coords, setCoords] = useState<CartesianCoords2D>({ x: 0, y: 0 });

  const pluginId = `TooltipPlugin, panel ${otherProps.id}`;

  // Debug logs
  useEffect(() => {
    pluginLog(pluginId, true, `Focused series: ${focusedSeriesIdx}, focused point: ${focusedPointIdx}`);
  }, [focusedPointIdx, focusedSeriesIdx]);

  // Add uPlot hooks to the config, or re-add when the config changed
  useLayoutEffect(() => {
    if (debug()) {
      config.addHook('init', (u) => {
        const canvas = u.root.querySelector<HTMLDivElement>('.u-over');
        if (!canvas) {
          return;
        }
        setPlotCanvasBBox(canvas.getBoundingClientRect());
      });
    }

    config.addHook('draw', (u) => {
      const canvas = u.root.querySelector<HTMLDivElement>('.u-over');
      if (!canvas) {
        return;
      }
      setPlotCanvasBBox(canvas.getBoundingClientRect());
    });

    config.addHook('setCursor', (u) => {
      // if (u.cursor.left === undefined || u.cursor.top === undefined) {
      //   return;
      // }
      console.log(u.bbox);
      setCoords({
        x: u.bbox.left + (u.cursor.left || 0),
        y: u.bbox.top + (u.cursor.top || 0),
      });
      setFocusedPointIdx(u.cursor.idx === undefined ? u.posToIdx(u.cursor.left || 0) : u.cursor.idx);
    });

    config.addHook('setSeries', (_, idx) => {
      setFocusedSeriesIdx(idx);
    });
  }, [config]);

  const plotInstance = plotCtx.getPlot();
  if (!plotInstance || focusedPointIdx === null) {
    return null;
  }

  // GraphNG expects aligned data, let's take field 0 as x field. FTW
  let xField = otherProps.data.fields[0];
  if (!xField) {
    return null;
  }
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });
  let tooltip = null;

  const xVal = xFieldFmt(xField!.values.get(focusedPointIdx)).text;

  // when interacting with a point in single mode
  if (mode === TooltipDisplayMode.Single && focusedSeriesIdx !== null) {
    const field = otherProps.data.fields[focusedSeriesIdx];
    const plotSeries = plotInstance.series;

    const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
    const value = fieldFmt(plotInstance.data[focusedSeriesIdx!][focusedPointIdx]);

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
    const plotSeries = plotInstance.series;

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

      const value = field.display!(plotInstance.data[i][focusedPointIdx]);

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

  if (!plotCanvasBBox) {
    return null;
  }

  return (
    <Portal>
      {debug() && (
        <div
          className={css`
            width: ${plotCanvasBBox.width}px;
            height: ${plotCanvasBBox.height}px;
            top: ${plotCanvasBBox.top}px;
            left: ${plotCanvasBBox.left}px;
            pointer-events: none;
            background: red;
            position: fixed;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0.2;
            font-family: monospace;
          `}
        >
          uPlot canvas debug
        </div>
      )}
      {tooltip && coords && (
        <VizTooltipContainer position={{ x: coords.x, y: coords.y }} offset={{ x: 10, y: 10 }}>
          {tooltip}
        </VizTooltipContainer>
      )}
    </Portal>
  );
};
