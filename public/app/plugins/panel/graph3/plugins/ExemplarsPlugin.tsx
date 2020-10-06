import React, { useCallback, useMemo } from 'react';
import { useObservable } from 'react-use';
import { map } from 'rxjs/operators';
import { AnnotationEvent, DataFrame, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import { getAnnotationsFromData } from 'app/features/annotations/standardAnnotationSupport';
import { EventsCanvas, usePlotContext } from '@grafana/ui';
import { ExemplarMarker } from './ExemplarMarker';

interface ExemplarsPluginProps {
  exemplars: DataFrame[];
  timeZone: TimeZone;
}

// tmp type to mock an exemplar events
interface ExemplarEvent extends AnnotationEvent {
  y: number;
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({ exemplars, timeZone }) => {
  // useRefreshAfterGraphRendered('Exemplars');
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

  const exemplarsEventsStream = useMemo(() => {
    // Mocking exemplars data
    return getAnnotationsFromData(exemplars).pipe(
      map<AnnotationEvent[], ExemplarEvent[]>(annotations => {
        return annotations.map(a => {
          let y;

          if (!plotCtx || !plotCtx.u) {
            y = 0;
          } else {
            y = Math.floor(Math.random() * (plotCtx.u.bbox.height / window.devicePixelRatio));
          }

          return {
            ...a,
            y,
          };
        });
      })
    );
  }, [exemplars, plotCtx]);

  const exemplarsData = useObservable<ExemplarEvent[]>(exemplarsEventsStream);

  if (!exemplarsData) {
    return null;
  }

  return (
    <EventsCanvas
      id="exemplars"
      events={exemplarsData}
      renderEventMarker={exemplar => <ExemplarMarker exemplar={exemplar} formatTime={timeFormatter} />}
      mapEventToXYCoords={exemplar => {
        if (!exemplar.time) {
          return undefined;
        }
        return {
          // get rid of !!
          x: plotCtx!.u!.valToPos(exemplar.time / 1000, 'x'),
          // exemplar.y is a temporary mock for an examplar
          y: exemplar.y,
        };
      }}
    />
  );
};
