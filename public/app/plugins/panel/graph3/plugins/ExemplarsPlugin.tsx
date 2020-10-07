import React, { useCallback, useEffect, useState } from 'react';
import { map } from 'rxjs/operators';
import { AnnotationEvent, DataFrame, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import { getAnnotationsFromData } from 'app/features/annotations/standardAnnotationSupport';
import { EventsCanvas, usePlotContext } from '@grafana/ui';
import { ExemplarMarker } from './ExemplarMarker';
import { Subscription } from 'rxjs';

interface ExemplarsPluginProps {
  exemplars: DataFrame[];
  timeZone: TimeZone;
}

// tmp type to mock an exemplar events
interface ExemplarEvent extends AnnotationEvent {
  y: number;
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({ exemplars, timeZone }) => {
  const plotCtx = usePlotContext();
  const [exemplarEvents, setExemplarEvents] = useState<ExemplarEvent[]>([]);

  const timeFormatter = useCallback(
    (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone,
      });
    },
    [timeZone]
  );

  useEffect(() => {
    let subscription: Subscription;
    if (plotCtx.isPlotReady) {
      subscription = getAnnotationsFromData(exemplars)
        .pipe(
          map<AnnotationEvent[], ExemplarEvent[]>(annotations => {
            return annotations.map(a => ({
              ...a,
              // temporary mock
              y: Math.random(),
            }));
          })
        )
        .subscribe(result => {
          setExemplarEvents(result);
        });
    }
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [plotCtx.isPlotReady, exemplars]);

  return (
    <EventsCanvas
      id="exemplars"
      events={exemplarEvents}
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
