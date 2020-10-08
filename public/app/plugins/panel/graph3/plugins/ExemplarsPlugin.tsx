import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrayVector,
  DataFrame,
  dateTimeFormat,
  FieldType,
  MutableDataFrame,
  systemDateFormats,
  TimeZone,
} from '@grafana/data';
import { EventsCanvas, usePlotContext } from '@grafana/ui';
import { ExemplarMarker } from './ExemplarMarker';

interface ExemplarsPluginProps {
  exemplars: DataFrame[];
  timeZone: TimeZone;
}

// Type representing exemplars data frame fields
interface ExemplarsDataFrameViewDTO {
  time: number;
  y: number;
  text: string;
  tags: string[];
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({ exemplars, timeZone }) => {
  const plotCtx = usePlotContext();

  // TEMPORARY MOCK
  const [exemplarsMock, setExemplarsMock] = useState<DataFrame[]>([]);

  const timeFormatter = useCallback(
    (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone,
      });
    },
    [timeZone]
  );

  // THIS EVENT ONLY MOCKS EXEMPLAR Y VALUE!!!! TO BE REMOVED WHEN WE GET CORRECT EXEMPLARS SHAPE VIA PROPS
  useEffect(() => {
    if (plotCtx.isPlotReady && exemplars.length) {
      const mocks: DataFrame[] = [];

      for (const frame of exemplars) {
        const mock = new MutableDataFrame(frame);
        mock.addField({
          name: 'y',
          type: FieldType.number,
          values: new ArrayVector(
            Array(frame.length)
              .fill(0)
              .map(() => Math.random())
          ),
        });
        mocks.push(mock);
      }

      console.log(mocks);
      setExemplarsMock(mocks);
    }
  }, [plotCtx.isPlotReady, exemplars]);

  return (
    <EventsCanvas<ExemplarsDataFrameViewDTO>
      id="exemplars"
      events={exemplarsMock}
      renderEventMarker={exemplar => <ExemplarMarker exemplar={exemplar} formatTime={timeFormatter} />}
      mapEventToXYCoords={exemplar => {
        if (!exemplar.time) {
          return undefined;
        }

        return {
          x: plotCtx.getPlotInstance().valToPos(exemplar.time / 1000, 'x'),
          // exemplar.y is a temporary mock for an examplar. This Needs to be calculated according to examplar scale!
          y: Math.floor((exemplar.y * plotCtx.getPlotInstance().bbox.height) / window.devicePixelRatio),
        };
      }}
    />
  );
};
