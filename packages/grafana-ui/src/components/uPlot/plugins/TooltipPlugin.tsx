import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMountedState } from 'react-use';
import uPlot from 'uplot';

import {
  arrayUtils,
  CartesianCoords2D,
  DashboardCursorSync,
  DataFrame,
  FALLBACK_COLOR,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  TimeZone,
} from '@grafana/data';
import { TooltipDisplayMode, SortOrder } from '@grafana/schema';

import { useTheme2 } from '../../../themes/ThemeContext';
import { Portal } from '../../Portal/Portal';
import { SeriesTable, SeriesTableRowProps, VizTooltipContainer } from '../../VizTooltip';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';
import { findMidPointYPosition, pluginLog } from '../utils';

interface TooltipPluginProps {
  timeZone: TimeZone;
  data: DataFrame;
  frames?: DataFrame[];
  config: UPlotConfigBuilder;
  mode?: TooltipDisplayMode;
  sortOrder?: SortOrder;
  sync?: () => DashboardCursorSync;
  // Allows custom tooltip content rendering. Exposes aligned data frame with relevant indexes for data inspection
  // Use field.state.origin indexes from alignedData frame field to get access to original data frame and field index.
  renderTooltip?: (alignedFrame: DataFrame, seriesIdx: number | null, datapointIdx: number | null) => React.ReactNode;
}

const TOOLTIP_OFFSET = 10;

/**
 * @alpha
 */
export const TooltipPlugin = ({
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  sync,
  timeZone,
  config,
  renderTooltip,
  ...otherProps
}: TooltipPluginProps) => {
  const plotInstance = useRef<uPlot>();
  const theme = useTheme2();
  const [focusedSeriesIdx, setFocusedSeriesIdx] = useState<number | null>(null);
  const [focusedPointIdx, setFocusedPointIdx] = useState<number | null>(null);
  const [focusedPointIdxs, setFocusedPointIdxs] = useState<Array<number | null>>([]);
  const [coords, setCoords] = useState<CartesianCoords2D | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const isMounted = useMountedState();

  const pluginId = `TooltipPlugin`;

  // Debug logs
  useEffect(() => {
    pluginLog(pluginId, true, `Focused series: ${focusedSeriesIdx}, focused point: ${focusedPointIdx}`);
  }, [focusedPointIdx, focusedSeriesIdx]);

  // Add uPlot hooks to the config, or re-add when the config changed
  useLayoutEffect(() => {
    let bbox: DOMRect | undefined = undefined;

    const plotEnter = () => {
      if (!isMounted()) {
        return;
      }
      setIsActive(true);
      plotInstance.current?.root.classList.add('plot-active');
    };

    const plotLeave = () => {
      if (!isMounted()) {
        return;
      }
      setCoords(null);
      setIsActive(false);
      plotInstance.current?.root.classList.remove('plot-active');
    };

    // cache uPlot plotting area bounding box
    config.addHook('syncRect', (u, rect) => (bbox = rect));

    config.addHook('init', (u) => {
      plotInstance.current = u;

      u.root.parentElement?.addEventListener('focus', plotEnter);
      u.over.addEventListener('mouseenter', plotEnter);

      u.root.parentElement?.addEventListener('blur', plotLeave);
      u.over.addEventListener('mouseleave', plotLeave);

      if (sync && sync() === DashboardCursorSync.Crosshair) {
        u.root.classList.add('shared-crosshair');
      }
    });

    const tooltipInterpolator = config.getTooltipInterpolator();

    if (tooltipInterpolator) {
      // Custom toolitp positioning
      config.addHook('setCursor', (u) => {
        tooltipInterpolator(
          setFocusedSeriesIdx,
          setFocusedPointIdx,
          (clear) => {
            if (clear) {
              setCoords(null);
              return;
            }

            if (!bbox) {
              return;
            }

            const { x, y } = positionTooltip(u, bbox);
            if (x !== undefined && y !== undefined) {
              setCoords({ x, y });
            }
          },
          u
        );
      });
    } else {
      config.addHook('setLegend', (u) => {
        if (!isMounted()) {
          return;
        }
        setFocusedPointIdx(u.legend.idx!);
        setFocusedPointIdxs(u.legend.idxs!.slice());
      });

      // default series/datapoint idx retireval
      config.addHook('setCursor', (u) => {
        if (!bbox || !isMounted()) {
          return;
        }

        const { x, y } = positionTooltip(u, bbox);
        if (x !== undefined && y !== undefined) {
          setCoords({ x, y });
        } else {
          setCoords(null);
        }
      });

      config.addHook('setSeries', (_, idx) => {
        if (!isMounted()) {
          return;
        }
        setFocusedSeriesIdx(idx);
      });
    }

    return () => {
      setCoords(null);
      if (plotInstance.current) {
        plotInstance.current.over.removeEventListener('mouseleave', plotLeave);
        plotInstance.current.over.removeEventListener('mouseenter', plotEnter);
        plotInstance.current.root.parentElement?.removeEventListener('focus', plotEnter);
        plotInstance.current.root.parentElement?.removeEventListener('blur', plotLeave);
      }
    };
  }, [config, setCoords, setIsActive, setFocusedPointIdx, setFocusedPointIdxs]);

  if (focusedPointIdx === null || (!isActive && sync && sync() === DashboardCursorSync.Crosshair)) {
    return null;
  }

  // GraphNG expects aligned data, let's take field 0 as x field. FTW
  let xField = otherProps.data.fields[0];
  if (!xField) {
    return null;
  }
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });
  let tooltip: React.ReactNode = null;

  let xVal = xFieldFmt(xField!.values.get(focusedPointIdx)).text;

  if (!renderTooltip) {
    // when interacting with a point in single mode
    if (mode === TooltipDisplayMode.Single && focusedSeriesIdx !== null) {
      const field = otherProps.data.fields[focusedSeriesIdx];

      if (!field) {
        return null;
      }

      const dataIdx = focusedPointIdxs?.[focusedSeriesIdx] ?? focusedPointIdx;
      xVal = xFieldFmt(xField!.values.get(dataIdx)).text;
      const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
      const display = fieldFmt(field.values.get(dataIdx));

      tooltip = (
        <SeriesTable
          series={[
            {
              color: display.color || FALLBACK_COLOR,
              label: getFieldDisplayName(field, otherProps.data, otherProps.frames),
              value: display ? formattedValueToString(display) : null,
            },
          ]}
          timestamp={xVal}
        />
      );
    }

    if (mode === TooltipDisplayMode.Multi) {
      let series: SeriesTableRowProps[] = [];
      const frame = otherProps.data;
      const fields = frame.fields;
      const sortIdx: unknown[] = [];

      for (let i = 0; i < fields.length; i++) {
        const field = frame.fields[i];
        if (
          !field ||
          field === xField ||
          field.type === FieldType.time ||
          field.type !== FieldType.number ||
          field.config.custom?.hideFrom?.tooltip ||
          field.config.custom?.hideFrom?.viz
        ) {
          continue;
        }

        const v = otherProps.data.fields[i].values.get(focusedPointIdxs[i]!);
        const display = field.display!(v);

        sortIdx.push(v);
        series.push({
          color: display.color || FALLBACK_COLOR,
          label: getFieldDisplayName(field, frame, otherProps.frames),
          value: display ? formattedValueToString(display) : null,
          isActive: focusedSeriesIdx === i,
        });
      }

      if (sortOrder !== SortOrder.None) {
        // create sort reference series array, as Array.sort() mutates the original array
        const sortRef = [...series];
        const sortFn = arrayUtils.sortValues(sortOrder);

        series.sort((a, b) => {
          // get compared values indices to retrieve raw values from sortIdx
          const aIdx = sortRef.indexOf(a);
          const bIdx = sortRef.indexOf(b);
          return sortFn(sortIdx[aIdx], sortIdx[bIdx]);
        });
      }

      tooltip = <SeriesTable series={series} timestamp={xVal} />;
    }
  } else {
    tooltip = renderTooltip(otherProps.data, focusedSeriesIdx, focusedPointIdx);
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

function isCursorOutsideCanvas({ left, top }: uPlot.Cursor, canvas: DOMRect) {
  if (left === undefined || top === undefined) {
    return false;
  }
  return left < 0 || left > canvas.width || top < 0 || top > canvas.height;
}

/**
 * Given uPlot cursor position, figure out position of the tooltip withing the canvas bbox
 * Tooltip is positioned relatively to a viewport
 * @internal
 **/
export function positionTooltip(u: uPlot, bbox: DOMRect) {
  let x, y;
  const cL = u.cursor.left || 0;
  const cT = u.cursor.top || 0;

  if (isCursorOutsideCanvas(u.cursor, bbox)) {
    const idx = u.posToIdx(cL);
    // when cursor outside of uPlot's canvas
    if (cT < 0 || cT > bbox.height) {
      let pos = findMidPointYPosition(u, idx);

      if (pos) {
        y = bbox.top + pos;
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
