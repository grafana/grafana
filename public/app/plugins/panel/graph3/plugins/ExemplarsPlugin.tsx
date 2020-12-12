import { DataFrame, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import { EventsCanvas, FIXED_UNIT, usePlotContext } from '@grafana/ui';
import React, { useCallback } from 'react';
import { ExemplarMarker } from './ExemplarMarker';

interface ExemplarsPluginProps {
  exemplars: DataFrame[];
  timeZone: TimeZone;
}

// Type representing exemplars data frame fields
export interface ExemplarsDataFrameViewDTO {
  time: number;
  y: number;
  component: React.ReactNode;
  tags: string[];
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({ exemplars, timeZone }) => {
  const plotCtx = usePlotContext();

  const timeFormatter = useCallback(
    (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone,
      });
    },
    [timeZone]
  );

  const mapExemplarToXYCoords = useCallback(
    (exemplar: ExemplarsDataFrameViewDTO) => {
      const plotInstance = plotCtx.getPlotInstance();

      if (!exemplar.time || !plotCtx.isPlotReady || !plotInstance) {
        return undefined;
      }

      // Filter x, y scales out
      const yScale =
        Object.keys(plotInstance.scales).find(scale => !['x', 'y'].some(key => key === scale)) ?? FIXED_UNIT;

      const yMin = plotInstance.scales[yScale].min;
      const yMax = plotInstance.scales[yScale].max;

      let y = exemplar.y;
      if (yMin != null && y < yMin) {
        y = yMin;
      }

      if (yMax != null && y > yMax) {
        y = yMax;
      }

      return {
        x: plotInstance.valToPos(exemplar.time, 'x'),
        y: plotInstance.valToPos(y, yScale),
      };
    },
    [plotCtx.isPlotReady, plotCtx.getPlotInstance]
  );

  const renderMarker = useCallback(
    (exemplar: ExemplarsDataFrameViewDTO) => {
      return <ExemplarMarker time={timeFormatter(exemplar.time)} component={exemplar.component} tags={exemplar.tags} />;
    },
    [timeFormatter]
  );

  return (
    <EventsCanvas<ExemplarsDataFrameViewDTO>
      id="exemplars"
      events={exemplars}
      renderEventMarker={renderMarker}
      mapEventToXYCoords={mapExemplarToXYCoords}
    />
  );
};
