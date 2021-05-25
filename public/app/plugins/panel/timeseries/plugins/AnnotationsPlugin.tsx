import { DataFrame, DataFrameFieldIndex, DataFrameView, getColorForTheme, TimeZone } from '@grafana/data';
import { EventsCanvas, UPlotConfigBuilder, usePlotContext, useTheme } from '@grafana/ui';
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { AnnotationMarker } from './AnnotationMarker';

interface AnnotationsPluginProps {
  config: UPlotConfigBuilder;
  annotations: DataFrame[];
  timeZone: TimeZone;
}

export const AnnotationsPlugin: React.FC<AnnotationsPluginProps> = ({ annotations, timeZone, config }) => {
  const theme = useTheme();
  const plotCtx = usePlotContext();

  const annotationsRef = useRef<Array<DataFrameView<AnnotationsDataFrameViewDTO>>>();

  // Update annotations views when new annotations came
  useEffect(() => {
    const views: Array<DataFrameView<AnnotationsDataFrameViewDTO>> = [];

    for (const frame of annotations) {
      views.push(new DataFrameView(frame));
    }

    annotationsRef.current = views;
  }, [annotations]);

  useLayoutEffect(() => {
    config.addHook('draw', (u) => {
      // Render annotation lines on the canvas
      /**
       * We cannot rely on state value here, as it would require this effect to be dependent on the state value.
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
          ctx.strokeStyle = getColorForTheme(annotation.color, theme);
          ctx.setLineDash([5, 5]);
          ctx.moveTo(xpos, u.bbox.top);
          ctx.lineTo(xpos, u.bbox.top + u.bbox.height);
          ctx.stroke();
          ctx.closePath();
        }
      }
      return;
    });
  }, [config, theme]);

  const mapAnnotationToXYCoords = useCallback(
    (frame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      const view = new DataFrameView<AnnotationsDataFrameViewDTO>(frame);
      const annotation = view.get(dataFrameFieldIndex.fieldIndex);
      const plotInstance = plotCtx.plot;
      if (!annotation.time || !plotInstance) {
        return undefined;
      }

      return {
        x: plotInstance.valToPos(annotation.time, 'x'),
        y: plotInstance.bbox.height / window.devicePixelRatio + 4,
      };
    },
    [plotCtx]
  );

  const renderMarker = useCallback(
    (frame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      const view = new DataFrameView<AnnotationsDataFrameViewDTO>(frame);
      const annotation = view.get(dataFrameFieldIndex.fieldIndex);
      return <AnnotationMarker annotation={annotation} timeZone={timeZone} />;
    },
    [timeZone]
  );

  return (
    <EventsCanvas
      id="annotations"
      config={config}
      events={annotations}
      renderEventMarker={renderMarker}
      mapEventToXYCoords={mapAnnotationToXYCoords}
    />
  );
};
