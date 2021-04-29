import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const plotCanvasBBox = useRef<DOMRect>();

  const [coords, setCoords] = useState<CartesianCoords2D | null>(null);

  const pluginId = `TooltipPlugin, panel ${otherProps.id}`;

  // Debug logs
  useEffect(() => {
    if (otherProps.id === 3) {
      console.log(pluginId, `Focused series: ${focusedSeriesIdx}, focused point: ${focusedPointIdx}`);
    }
    pluginLog(pluginId, true, `Focused series: ${focusedSeriesIdx}, focused point: ${focusedPointIdx}`);
  }, [focusedPointIdx, focusedSeriesIdx]);

  // Add uPlot hooks to the config, or re-add when the config changed
  useLayoutEffect(() => {
    config.addHook('setSize', (u) => {
      const canvas = u.root.querySelector<HTMLDivElement>('.u-over');
      if (!canvas) {
        return;
      }
      plotCanvasBBox.current = canvas.getBoundingClientRect();
    });

    config.addHook('setCursor', (u) => {
      const bbox = plotCanvasBBox.current;
      if (!bbox) {
        return;
      }

      let x, y;
      const cL = u.cursor.left || 0;
      const cT = u.cursor.top || 0;

      if (!isCursourOutsideCanvas(u.cursor, bbox)) {
        x = bbox.left + cL;
        y = bbox.top + cT;
      } else {
        if (cL >= 0 && cL <= bbox.width) {
          // outside left bound
          x = bbox.left + cL;
        }

        if (cT < 0) {
          // outside left bound
          y = bbox.top;
        }

        if (cT > bbox.height) {
          // outside right bound
          y = bbox.top + bbox.height;
        }
      }

      if (x !== undefined && y !== undefined) {
        setCoords({ x, y });
      } else {
        setCoords(null);
      }

      setFocusedPointIdx(u.cursor.idx === undefined ? u.posToIdx(u.cursor.left || 0) : u.cursor.idx);
    });

    config.addHook('setSeries', (_, idx) => {
      setFocusedSeriesIdx(idx);
    });
  }, [config]);

  const plotInstance = plotCtx.getPlot();

  if (!plotInstance || focusedPointIdx === null || !plotCanvasBBox.current) {
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

  return (
    <Portal>
      {tooltip && coords && (
        <VizTooltipContainer position={{ x: coords.x, y: coords.y }} offset={{ x: 10, y: 10 }}>
          {tooltip}
        </VizTooltipContainer>
      )}
    </Portal>
  );
};

function isCursourOutsideCanvas({ left, top }: uPlot.Cursor, canvas: DOMRect) {
  if (!left || !top) {
    return false;
  }
  return left < 0 || left > canvas.width || top < 0 || top > canvas.height;
}
