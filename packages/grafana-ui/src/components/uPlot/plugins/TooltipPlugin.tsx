import React, { useEffect, useLayoutEffect, useState } from 'react';
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
import { useTheme2 } from '../../../themes/ThemeContext';
import uPlot from 'uplot';

interface TooltipPluginProps {
  mode?: TooltipDisplayMode;
  timeZone: TimeZone;
  data: DataFrame;
  config: UPlotConfigBuilder;
}

const TOOLTIP_OFFSET = 10;

/**
 * @alpha
 */
export const TooltipPlugin: React.FC<TooltipPluginProps> = ({
  mode = TooltipDisplayMode.Single,
  timeZone,
  config,
  ...otherProps
}) => {
  const theme = useTheme2();
  const plotCtx = usePlotContext();
  const [focusedSeriesIdx, setFocusedSeriesIdx] = useState<number | null>(null);
  const [focusedPointIdx, setFocusedPointIdx] = useState<number | null>(null);

  const [coords, setCoords] = useState<CartesianCoords2D | null>(null);

  const pluginId = `TooltipPlugin`;

  // Debug logs
  useEffect(() => {
    pluginLog(pluginId, true, `Focused series: ${focusedSeriesIdx}, focused point: ${focusedPointIdx}`);
  }, [focusedPointIdx, focusedSeriesIdx]);

  // Add uPlot hooks to the config, or re-add when the config changed
  useLayoutEffect(() => {
    config.addHook('setCursor', (u) => {
      const bbox = plotCtx.getCanvasBoundingBox();
      if (!bbox) {
        return;
      }

      const { x, y } = positionTooltip(u, bbox);

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
  }, [plotCtx, config]);

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

  return (
    <Portal>
      {tooltip && coords && (
        <VizTooltipContainer position={{ x: coords.x, y: coords.y }} offset={{ x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET }}>
          {tooltip}
        </VizTooltipContainer>
      )}
    </Portal>
  );
};

function isCursourOutsideCanvas({ left, top }: uPlot.Cursor, canvas: DOMRect) {
  if (left === undefined || top === undefined) {
    return false;
  }
  return left < 0 || left > canvas.width || top < 0 || top > canvas.height;
}

/**
 * Given uPlot cursor position, figure out position of the tooltip withing the canvas bbox
 * Tooltip is positioned relatively to a viewport
 **/
function positionTooltip(u: uPlot, bbox: DOMRect) {
  let x, y;
  const cL = u.cursor.left || 0;
  const cT = u.cursor.top || 0;

  if (isCursourOutsideCanvas(u.cursor, bbox)) {
    const idx = u.posToIdx(cL);
    let sMaxIdx = 1;
    let sMinIdx = 1;

    // when cursor outside of uPlot's canvas
    if (cT < 0 || cT > bbox.height) {
      // assume min/max being values of 1st series
      let max = u.data[1][idx];
      let min = u.data[1][idx];

      // find min max values AND ids of the corresponding series to get the scales
      for (let i = 1; i < u.data.length; i++) {
        const sData = u.data[i];
        const sVal = sData[idx];
        if (sVal !== null) {
          if (max === null) {
            max = sVal;
          } else {
            if (sVal > max) {
              max = u.data[i][idx];
              sMaxIdx = i;
            }
          }
          if (min === null) {
            min = sVal;
          } else {
            if (sVal < min) {
              min = u.data[i][idx];
              sMinIdx = i;
            }
          }
        }
      }

      if (min === null && max === null) {
        // no tooltip to show
        y = undefined;
      } else if (min !== null && max !== null) {
        // find median position
        y =
          -TOOLTIP_OFFSET +
          bbox.top +
          (u.valToPos(min, u.series[sMinIdx].scale!) + u.valToPos(max, u.series[sMaxIdx].scale!)) / 2;
      } else {
        // snap tooltip to min OR max point, one of thos is not null :)
        y = bbox.top + u.valToPos((min || max)!, u.series[(sMaxIdx || sMinIdx)!].scale!);
      }

      if (y) {
        if (cL >= 0 && cL <= bbox.width) {
          // find x-scale position for a current cursor left position
          x = bbox.left + u.valToPos(u.data[0][u.posToIdx(cL)], u.series[0].scale!);
        }
      }
    }
  } else {
    x = bbox.left + cL;
    y = bbox.top + cT;
  }

  return { x, y };
}
