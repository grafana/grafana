import React from 'react';
import { Portal } from '../../Portal/Portal';
import { usePlotCanvas, usePlotContext, usePlotData } from '../context';
import { CursorPlugin } from './CursorPlugin';
import { SeriesTable } from '../../Graph/GraphTooltip/SeriesTable';
import { FieldType, formattedValueToString, getDisplayProcessor, getFieldDisplayName, TimeZone } from '@grafana/data';
import { TooltipContainer } from '../../Chart/TooltipContainer';
import { TooltipMode } from '../../Chart/Tooltip';

interface TooltipPluginProps {
  mode?: TooltipMode;
  timeZone: TimeZone;
}

export const TooltipPlugin: React.FC<TooltipPluginProps> = ({ mode = 'single', timeZone }) => {
  const pluginId = 'PlotTooltip';
  const plotContext = usePlotContext();
  const plotCanvas = usePlotCanvas();
  const { data, getField, getXAxisFields } = usePlotData();

  if (!plotContext || !plotContext.series || !plotCanvas) {
    return null;
  }

  const xAxisFields = getXAxisFields();
  // assuming single x-axis
  const xAxisField = xAxisFields[0];
  const xAxisFmt = xAxisField.display || getDisplayProcessor({ field: xAxisField, timeZone });

  return (
    <CursorPlugin id={pluginId}>
      {({ focusedSeriesIdx, focusedPointIdx, coords }) => {
        let tooltip = null;

        // no cursor interaction
        if (focusedPointIdx === null) {
          return null;
        }

        // if interacting with a point in single mode
        if (mode === 'single' && focusedSeriesIdx !== null) {
          const xVal = xAxisFmt(xAxisFields[0]!.values.get(focusedPointIdx)).text;
          const field = getField(focusedSeriesIdx);
          const fieldFmt = field.display || getDisplayProcessor({ field, timeZone });
          tooltip = (
            <SeriesTable
              series={[
                {
                  // stroke is typed as CanvasRenderingContext2D['strokeStyle'] - we are using strings only for now
                  color: plotContext!.series[focusedSeriesIdx!].stroke as string,
                  label: getFieldDisplayName(field, data),
                  value: fieldFmt(field.values.get(focusedPointIdx)).text,
                },
              ]}
              timestamp={xVal}
            />
          );
        }

        if (mode === 'multi') {
          const xVal = xAxisFmt(xAxisFields[0].values.get(focusedPointIdx)).text;
          tooltip = (
            <SeriesTable
              series={data.fields.reduce((agg, f, i) => {
                // skipping time field and non-numeric fields
                if (f.type === FieldType.time || f.type !== FieldType.number) {
                  return agg;
                }

                return [
                  ...agg,
                  {
                    // stroke is typed as CanvasRenderingContext2D['strokeStyle'] - we are using strings only for now
                    color: plotContext!.series[i].stroke as string,
                    label: getFieldDisplayName(f, data),
                    value: formattedValueToString(f.display!(f.values.get(focusedPointIdx!))),
                    isActive: focusedSeriesIdx === i,
                  },
                ];
              }, [])}
              timestamp={xVal}
            />
          );
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
