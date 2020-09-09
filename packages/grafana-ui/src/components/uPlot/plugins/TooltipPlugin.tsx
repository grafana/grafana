import React from 'react';
import { Portal } from '../../Portal/Portal';
import { usePlotCanvas, usePlotContext, usePlotData } from '../context';
import { CursorPlugin } from './CursorPlugin';
import { pluginLog } from '../utils';
import { SeriesTable } from '../../Graph/GraphTooltip/SeriesTable';
import { FieldType, formattedValueToString, getFieldDisplayName } from '@grafana/data';
import { TooltipContainer } from '../../Chart/TooltipContainer';
import { TooltipMode } from '../../Chart/Tooltip';

interface TooltipPluginProps {
  mode?: TooltipMode;
}

export const TooltipPlugin: React.FC<TooltipPluginProps> = ({ mode = 'single' }) => {
  const pluginId = 'PlotTooltip';
  const plotContext = usePlotContext();
  const plotCanvas = usePlotCanvas();
  const { data, getField, getXAxisFields } = usePlotData();

  if (!plotContext || !plotCanvas) {
    return null;
  }

  const xAxisFields = getXAxisFields();

  return (
    <CursorPlugin id={pluginId}>
      {({ focusedSeriesIdx, focusedPointIdx, coords }) => {
        pluginLog(pluginId, true, 'coords', coords);
        const xVal = xAxisFields[0].display(xAxisFields[0].values.get(focusedPointIdx)).text;
        const field = getField(focusedSeriesIdx);

        // in single mode, if there is no focused series we do not render anything
        if (mode === 'single' && focusedSeriesIdx === null) {
          return null;
        }

        return (
          <Portal>
            <TooltipContainer position={{ x: coords.viewport.x, y: coords.viewport.y }} offset={{ x: 10, y: 10 }}>
              {mode === 'single' ? (
                <SeriesTable
                  series={[
                    {
                      color: plotContext.series[focusedSeriesIdx].stroke,
                      label: getFieldDisplayName(field, data),
                      value: formattedValueToString(field.display!(field.values.get(focusedPointIdx!))),
                    },
                  ]}
                  timestamp={xVal}
                />
              ) : (
                <SeriesTable
                  series={data.fields.reduce((agg, f, i) => {
                    // skipping time field and non-numeric fields
                    if (f.type === FieldType.time || f.type !== FieldType.number) {
                      return agg;
                    }

                    return [
                      ...agg,
                      {
                        color: plotContext.series[i].stroke,
                        label: getFieldDisplayName(f, data),
                        value: formattedValueToString(f.display!(f.values.get(focusedPointIdx!))),
                        isActive: focusedSeriesIdx === i,
                      },
                    ];
                  }, [])}
                  timestamp={xVal}
                />
              )}
            </TooltipContainer>
          </Portal>
        );
      }}
    </CursorPlugin>
  );
};
