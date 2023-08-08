import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import uPlot from 'uplot';

import { DataFrame, DataFrameFieldIndex, DataFrameView, FieldType, MutableDataFrame, TimeZone } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { EventsCanvas, UPlotConfigBuilder, useTheme2 } from '@grafana/ui';

import type { TimeMarkerChangedEvent } from '../../../../../../packages/grafana-runtime/src/services/appEvents';

import { AnnotationMarker } from './annotations/AnnotationMarker';
import { AnnotationsDataFrameViewDTO } from './types';

interface TimeMarkerPluginProps {
  config: UPlotConfigBuilder;
  timeZone: TimeZone;
}

export const TimeMarkerPlugin = ({ timeZone, config }: TimeMarkerPluginProps) => {
  const theme = useTheme2();
  const plotInstance = useRef<uPlot>();

  const [timeMarkerMap, setTimeMarkerMap] = useState<Record<string, number>>({});
  const [timeMarkers, setTimeMarkers] = useState<DataFrame[]>([]);

  const timeMarkersRef = useRef<Array<DataFrameView<AnnotationsDataFrameViewDTO>>>();

  // Update annotations views when new annotations came
  useEffect(() => {
    const views: Array<DataFrameView<AnnotationsDataFrameViewDTO>> = [];

    for (const frame of timeMarkers) {
      views.push(new DataFrameView(frame));
    }

    timeMarkersRef.current = views;

    return () => {
      // clear on unmount
      timeMarkersRef.current = [];
    };
  }, [timeMarkers]);

  useEffect(() => {
    const handler = (event: TimeMarkerChangedEvent) => {
      const { time, id } = event.payload;
      setTimeMarkerMap({ ...timeMarkerMap, [id]: time });
    };
    const subscription = getAppEvents().subscribe({ type: 'time-marker-changed' }, handler);

    return () => {
      subscription.unsubscribe();
    };
  }, [timeMarkerMap, setTimeMarkerMap]);

  useEffect(() => {
    const frame = new MutableDataFrame();

    frame.addField({ name: 'id', type: FieldType.string });
    frame.addField({ name: 'time', type: FieldType.time });
    frame.addField({ name: 'color', type: FieldType.string });
    frame.addField({ name: 'text', type: FieldType.string });

    Object.keys(timeMarkerMap).forEach((id) => {
      const time: number | null = timeMarkerMap[id];
      const color = '#ffb74c';

      if (time != null) {
        frame.add({ id, time, color, text: id });
      }
    });

    setTimeMarkers([frame]);

    plotInstance?.current?.redraw();
  }, [timeMarkerMap]);

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });

    config.addHook('draw', (u) => {
      // Render annotation lines on the canvas
      /**
       * We cannot rely on state value here, as it would require this effect to be dependent on the state value.
       */
      if (!timeMarkersRef.current) {
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

      for (let i = 0; i < timeMarkersRef.current.length; i++) {
        const annotationsView = timeMarkersRef.current[i];
        for (let j = 0; j < annotationsView.length; j++) {
          const annotation = annotationsView.get(j);

          if (!annotation.time) {
            continue;
          }

          let x0 = u.valToPos(annotation.time, 'x', true);
          const color = theme.visualization.getColorByName(annotation.color);

          renderLine(x0, color);
        }
      }
      ctx.restore();
      return;
    });
  }, [config, theme]);

  const mapTimeMarkerToXYCoords = useCallback((frame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
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
      events={timeMarkers}
      renderEventMarker={renderMarker}
      mapEventToXYCoords={mapTimeMarkerToXYCoords}
    />
  );
};
