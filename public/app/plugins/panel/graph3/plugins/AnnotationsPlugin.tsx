import { AnnotationEvent, DataFrame, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import {
  EventsCanvas,
  usePlotContext,
  usePlotPluginContext,
  useRefreshAfterGraphRendered,
  useTheme,
} from '@grafana/ui';
import { getAnnotationsFromData } from 'app/features/annotations/standardAnnotationSupport';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnnotationMarker } from './AnnotationMarker';
import { useObservable } from 'react-use';

interface AnnotationsPluginProps {
  annotations: DataFrame[];
  timeZone: TimeZone;
}

export const AnnotationsPlugin: React.FC<AnnotationsPluginProps> = ({ annotations, timeZone }) => {
  const pluginId = 'AnnotationsPlugin';
  const plotCtx = usePlotContext();
  const pluginsApi = usePlotPluginContext();
  const annotationsRef = useRef<AnnotationEvent[]>();
  // const [_, setRenderCounter] = useState(0);
  const theme = useTheme();
  // useRefreshAfterGraphRendered('Annotations');
  const timeFormatter = useCallback(
    (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone,
      });
    },
    [timeZone]
  );

  const annotationEventsStream = useMemo(() => getAnnotationsFromData(annotations), [annotations]);
  const annotationsData = useObservable<AnnotationEvent[]>(annotationEventsStream);

  // For uPlot plugin to have access to lates annotation data we need to update the data ref
  useEffect(() => {
    annotationsRef.current = annotationsData;
  }, [annotationsData]);

  useEffect(() => {
    const unregister = pluginsApi.registerPlugin({
      id: pluginId,
      hooks: {
        // Render annotation lines on the canvas
        draw: u => {
          /**
           * We cannot rely on state value here, as it would require this effect to be dependent on the state value.
           * This would make the plugin re-register making the entire plot to reinitialise. ref is the way to go :)
           */
          if (!annotationsRef.current) {
            return null;
          }
          const ctx = u.ctx;
          if (!ctx) {
            return;
          }
          for (let i = 0; i < annotationsRef.current.length; i++) {
            const annotation = annotationsRef.current[i];
            if (!annotation.time) {
              continue;
            }
            const xpos = u.valToPos(annotation.time / 1000, 'x', true);
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = theme.palette.red;
            ctx.setLineDash([5, 5]);
            ctx.moveTo(xpos, u.bbox.top);
            ctx.lineTo(xpos, u.bbox.top + u.bbox.height);
            ctx.stroke();
            ctx.closePath();
          }
          // setRenderCounter(c => c + 1);
          return;
        },
      },
    });

    return () => {
      unregister();
    };
  }, []);

  if (!annotationsData) {
    return null;
  }

  return (
    <EventsCanvas
      id="annotations"
      events={annotationsData}
      renderEventMarker={event => <AnnotationMarker annotationEvent={event} formatTime={timeFormatter} />}
      mapEventToXYCoords={annotation => {
        if (!annotation.time) {
          return undefined;
        }

        return {
          x: plotCtx!.u!.valToPos(annotation.time / 1000, 'x'),
          y: plotCtx!.u!.bbox.height / window.devicePixelRatio + 4,
        };
      }}
    />
  );
};
