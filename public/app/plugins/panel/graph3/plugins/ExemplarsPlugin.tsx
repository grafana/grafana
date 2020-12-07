import { DataFrame, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import { EventsCanvas, usePlotContext } from '@grafana/ui';
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

      return {
        x: plotInstance.valToPos(exemplar.time, 'x'),
        y: plotInstance.valToPos(exemplar.y, '__fixed'),
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
