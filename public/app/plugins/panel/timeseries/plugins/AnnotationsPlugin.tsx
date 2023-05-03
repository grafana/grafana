import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import uPlot from 'uplot';

import { colorManipulator, DataFrame, DataFrameFieldIndex, DataFrameView, TimeZone } from '@grafana/data';
import { EventsCanvas, UPlotConfigBuilder, useTheme2 } from '@grafana/ui';

import { AnnotationMarker } from './annotations/AnnotationMarker';
import { AnnotationsDataFrameViewDTO } from './types';

interface AnnotationsPluginProps {
  config: UPlotConfigBuilder;
  annotations: DataFrame[];
  timeZone: TimeZone;
}

export const AnnotationsPlugin = ({ annotations, timeZone, config }: AnnotationsPluginProps) => {
  const theme = useTheme2();
  const plotInstance = useRef<uPlot>();

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
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });

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

  const mapAnnotationToXYCoords = useCallback((frame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
    const view = new DataFrameView<AnnotationsDataFrameViewDTO>(frame);
    const annotation = view.get(dataFrameFieldIndex.fieldIndex);

    if (!annotation.time || !plotInstance.current) {
      return undefined;
    }
    let x = plotInstance.current.valToPos(annotation.time, 'x');

    if (x < 0) {
      x = 0;
    }
    return {
      x,
      y: plotInstance.current.bbox.height / window.devicePixelRatio + 4,
    };
  }, []);

  const renderMarker = useCallback(
    (frame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      let width = 0;
      const view = new DataFrameView<AnnotationsDataFrameViewDTO>(frame);
      const annotation = view.get(dataFrameFieldIndex.fieldIndex);
      const isRegionAnnotation = Boolean(annotation.isRegion);

      if (isRegionAnnotation && plotInstance.current) {
        let x0 = plotInstance.current.valToPos(annotation.time, 'x');
        let x1 = plotInstance.current.valToPos(annotation.timeEnd, 'x');

        // markers are rendered relatively to uPlot canvas overly, not caring about axes width
        if (x0 < 0) {
          x0 = 0;
        }

        if (x1 > plotInstance.current.bbox.width / window.devicePixelRatio) {
          x1 = plotInstance.current.bbox.width / window.devicePixelRatio;
        }
        width = x1 - x0;
      }

      return <AnnotationMarker annotation={annotation} timeZone={timeZone} width={width} />;
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
