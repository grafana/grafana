import { DataFrame, DataFrameView, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import { EventsCanvas, usePlotContext, useTheme } from '@grafana/ui';
import React, { useCallback, useEffect, useRef } from 'react';
import { AnnotationMarker } from './AnnotationMarker';

interface AnnotationsPluginProps {
  annotations: DataFrame[];
  timeZone: TimeZone;
}

interface AnnotationsDataFrameViewDTO {
  time: number;
  text: string;
  tags: string[];
}

export const AnnotationsPlugin: React.FC<AnnotationsPluginProps> = ({ annotations, timeZone }) => {
  const pluginId = 'AnnotationsPlugin';
  const plotCtx = usePlotContext();

  const theme = useTheme();
  const annotationsRef = useRef<Array<DataFrameView<AnnotationsDataFrameViewDTO>>>();

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
    if (plotCtx.isPlotReady) {
      const views: Array<DataFrameView<AnnotationsDataFrameViewDTO>> = [];

      for (const frame of annotations) {
        views.push(new DataFrameView(frame));
      }

      annotationsRef.current = views;
    }
  }, [plotCtx.isPlotReady, annotations]);

  useEffect(() => {
    const unregister = plotCtx.registerPlugin({
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
            const annotationsView = annotationsRef.current[i];
            for (let j = 0; j < annotationsView.length; j++) {
              const annotation = annotationsView.get(j);

              if (!annotation.time) {
                continue;
              }

              const xpos = u.valToPos(annotation.time, 'x', true);
              ctx.beginPath();
              ctx.lineWidth = 2;
              ctx.strokeStyle = theme.palette.red;
              ctx.setLineDash([5, 5]);
              ctx.moveTo(xpos, u.bbox.top);
              ctx.lineTo(xpos, u.bbox.top + u.bbox.height);
              ctx.stroke();
              ctx.closePath();
            }
          }
          return;
        },
      },
    });

    return () => {
      unregister();
    };
  }, []);

  const mapAnnotationToXYCoords = useCallback(
    (annotation: AnnotationsDataFrameViewDTO) => {
      const plotInstance = plotCtx.getPlotInstance();
      if (!annotation.time || !plotInstance) {
        return undefined;
      }

      return {
        x: plotInstance.valToPos(annotation.time, 'x'),
        y: plotInstance.bbox.height / window.devicePixelRatio + 4,
      };
    },
    [plotCtx.getPlotInstance]
  );

  const renderMarker = useCallback(
    (annotation: AnnotationsDataFrameViewDTO) => {
      return <AnnotationMarker time={timeFormatter(annotation.time)} text={annotation.text} tags={annotation.tags} />;
    },
    [timeFormatter]
  );

  return (
    <EventsCanvas<AnnotationsDataFrameViewDTO>
      id="annotations"
      events={annotations}
      renderEventMarker={renderMarker}
      mapEventToXYCoords={mapAnnotationToXYCoords}
    />
  );
};
