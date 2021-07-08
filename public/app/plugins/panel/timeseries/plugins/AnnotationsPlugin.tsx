import { colorManipulator, DataFrame, DataFrameFieldIndex, DataFrameView, TimeZone } from '@grafana/data';
import { EventsCanvas, UPlotConfigBuilder, usePlotContext, useTheme } from '@grafana/ui';
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { AnnotationMarker } from './annotations/AnnotationMarker';

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
      ctx.save();
      ctx.beginPath();
      ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
      ctx.clip();

      const renderLine = (x: number, color: string) => {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(x, u.bbox.top);
        ctx.lineTo(x, u.bbox.top + u.bbox.height);
        ctx.stroke();
        ctx.closePath();
      };

      for (let i = 0; i < annotationsRef.current.length; i++) {
        const annotationsView = annotationsRef.current[i];
        for (let j = 0; j < annotationsView.length; j++) {
          const annotation = annotationsView.get(j);

          if (!annotation.time) {
            continue;
          }

          let x0 = u.valToPos(annotation.time, 'x', true);
          const color = theme.visualization.getColorByName(annotation.color);

          renderLine(x0, color);

          if (annotation.isRegion && annotation.timeEnd) {
            let x1 = u.valToPos(annotation.timeEnd, 'x', true);

            renderLine(x1, color);

            ctx.fillStyle = colorManipulator.alpha(color, 0.1);
            ctx.rect(x0, u.bbox.top, x1 - x0, u.bbox.height);
            ctx.fill();
          }
        }
      }
      ctx.restore();
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
      let x = plotInstance.valToPos(annotation.time, 'x');

      if (x < 0) {
        x = 0;
      }
      return {
        x,
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
