import {
  DataFrame,
  Field,
  LinkModel,
  TimeZone,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '@grafana/data';
import { EventsCanvas, FIXED_UNIT, usePlotContext } from '@grafana/ui';
import React, { useCallback } from 'react';
import { ExemplarMarker } from './ExemplarMarker';

interface ExemplarsPluginProps {
  exemplars: DataFrame[];
  timeZone: TimeZone;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({ exemplars, timeZone, getFieldLinks }) => {
  const plotCtx = usePlotContext();

  const mapExemplarToXYCoords = useCallback(
    (dataFrame: DataFrame, index: number) => {
      const plotInstance = plotCtx.getPlotInstance();
      const time = dataFrame.fields.find((f) => f.name === TIME_SERIES_TIME_FIELD_NAME);
      const value = dataFrame.fields.find((f) => f.name === TIME_SERIES_VALUE_FIELD_NAME);

      if (!time || !value || !plotCtx.isPlotReady || !plotInstance) {
        return undefined;
      }

      // Filter x, y scales out
      const yScale =
        Object.keys(plotInstance.scales).find((scale) => !['x', 'y'].some((key) => key === scale)) ?? FIXED_UNIT;

      const yMin = plotInstance.scales[yScale].min;
      const yMax = plotInstance.scales[yScale].max;

      let y = value.values.get(index);
      // To not to show exemplars outside of the graph we set the y value to min if it is smaller and max if it is bigger than the size of the graph
      if (yMin != null && y < yMin) {
        y = yMin;
      }

      if (yMax != null && y > yMax) {
        y = yMax;
      }

      return {
        x: plotInstance.valToPos(time.values.get(index), 'x'),
        y: plotInstance.valToPos(y, yScale),
      };
    },
    [plotCtx]
  );

  const renderMarker = useCallback(
    (dataFrame: DataFrame, index: number) => {
      return <ExemplarMarker timeZone={timeZone} getFieldLinks={getFieldLinks} dataFrame={dataFrame} index={index} />;
    },
    [timeZone, getFieldLinks]
  );

  return (
    <EventsCanvas
      id="exemplars"
      events={exemplars}
      renderEventMarker={renderMarker}
      mapEventToXYCoords={mapExemplarToXYCoords}
    />
  );
};
