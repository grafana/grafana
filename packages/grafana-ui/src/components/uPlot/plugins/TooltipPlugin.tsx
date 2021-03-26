import React from 'react';
import { Portal } from '../../Portal/Portal';
import { usePlotContext } from '../context';
import { CursorPlugin } from './CursorPlugin';
import { SeriesTable, SeriesTableRowProps } from '../../Graph/GraphTooltip/SeriesTable';
import {
  DataFrame,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  TimeZone,
} from '@grafana/data';
import { TooltipContainer } from '../../Chart/TooltipContainer';
import { TooltipMode } from '../../Chart/Tooltip';
import { useGraphNGContext } from '../../GraphNG/hooks';

interface TooltipPluginProps {
  mode?: TooltipMode;
  timeZone: TimeZone;
  data: DataFrame[];
}

/**
 * @alpha
 */
export const TooltipPlugin: React.FC<TooltipPluginProps> = ({ mode = 'single', timeZone, ...otherProps }) => {
  const pluginId = 'PlotTooltip';
  const plotContext = usePlotContext();
  const graphContext = useGraphNGContext();

  let xField = graphContext.getXAxisField();
  if (!xField) {
    return null;
  }

  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone });

  return (
    <CursorPlugin id={pluginId}>
      {({ focusedSeriesIdx, focusedPointIdx, coords }) => {
        if (!plotContext.getPlotInstance()) {
          return null;
        }
        let tooltip = null;

        // when no no cursor interaction
        if (focusedPointIdx === null) {
          return null;
        }

        const xVal = xFieldFmt(xField!.values.get(focusedPointIdx)).text;

        // origin field/frame indexes for inspecting the data
        const originFieldIndex = focusedSeriesIdx
          ? graphContext.mapSeriesIndexToDataFrameFieldIndex(focusedSeriesIdx)
          : null;

        // when interacting with a point in single mode
        if (mode === 'single' && originFieldIndex !== null) {
          const field = otherProps.data[originFieldIndex.frameIndex].fields[originFieldIndex.fieldIndex];
          const plotSeries = plotContext.getSeries();
          const fieldFmt = field.display || getDisplayProcessor({ field, timeZone });
          const value = fieldFmt(plotContext.data[focusedSeriesIdx!][focusedPointIdx]);

          tooltip = (
            <SeriesTable
              series={[
                {
                  // TODO: align with uPlot typings
                  color: (plotSeries[focusedSeriesIdx!].stroke as any)(),
                  label: getFieldDisplayName(field, otherProps.data[originFieldIndex.frameIndex]),
                  value: value ? formattedValueToString(value) : null,
                },
              ]}
              timestamp={xVal}
            />
          );
        }

        if (mode === 'multi') {
          let series: SeriesTableRowProps[] = [];
          const plotSeries = plotContext.getSeries();

          for (let i = 0; i < plotSeries.length; i++) {
            const dataFrameFieldIndex = graphContext.mapSeriesIndexToDataFrameFieldIndex(i);
            const frame = otherProps.data[dataFrameFieldIndex.frameIndex];
            const field = otherProps.data[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex];
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
              isActive: originFieldIndex
                ? dataFrameFieldIndex.frameIndex === originFieldIndex.frameIndex &&
                  dataFrameFieldIndex.fieldIndex === originFieldIndex.fieldIndex
                : false,
            });
          }

          tooltip = <SeriesTable series={series} timestamp={xVal} />;
        }

        if (!tooltip) {
          return null;
        }

        return (
          <Portal>
            <TooltipContainer position={{ x: coords.viewport.x, y: coords.viewport.y }} offset={{ x: 10, y: 10 }}>
              {tooltip}
            </TooltipContainer>
          </Portal>
        );
      }}
    </CursorPlugin>
  );
};
