import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as React from 'react';
import { useMountedState } from 'react-use';
import type uPlot from 'uplot';

import { type DataFrame } from '@grafana/data';

import { type UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { Marker } from './Marker';
import { XYCanvas } from './XYCanvas';

interface EventsCanvasViewProps {
  id: string;
  events: DataFrame[];
  renderEventMarker: (dataFrame: DataFrame, rowIndex: number) => ReactNode;
  mapEventToXYCoords: (dataFrame: DataFrame, rowIndex: number) => { x: number; y: number } | undefined;
}

interface EventsCanvasProps extends EventsCanvasViewProps {
  config: UPlotConfigBuilder;
}

// annotation layers can supply frames with zero rows, so count rows rather than frames
const hasEventRows = (events: DataFrame[]) => events.some((frame) => frame.length > 0);

export function EventsCanvas({ id, events, renderEventMarker, mapEventToXYCoords, config }: EventsCanvasProps) {
  const plotInstance = useRef<uPlot | undefined>(undefined);
  // render token required to re-render annotation markers. Rendering lines happens in uPlot and the props do not change
  // so we need to force the re-render when the draw hook was performed by uPlot
  const [renderToken, setRenderToken] = useState(0);
  const isMounted = useMountedState();
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });

    config.addHook('draw', () => {
      // with no events there is nothing to reposition, so skip the re-render; new events re-render via props
      if (!isMounted() || !hasEventRows(eventsRef.current)) {
        return;
      }
      setRenderToken((s) => s + 1);
    });
  }, [config, setRenderToken]);

  if (!plotInstance.current || !hasEventRows(events)) {
    return null;
  }

  return (
    <EventsCanvasView
      id={id}
      events={events}
      renderEventMarker={renderEventMarker}
      mapEventToXYCoords={mapEventToXYCoords}
      plot={plotInstance.current}
      renderToken={renderToken}
    />
  );
}

export function EventsCanvasView({
  id,
  events,
  renderEventMarker,
  mapEventToXYCoords,
  plot,
  renderToken,
}: EventsCanvasViewProps & { plot: uPlot; renderToken: number }) {
  const eventMarkers = useMemo(() => {
    const markers: React.ReactNode[] = [];

    for (let i = 0; i < events.length; i++) {
      const frame = events[i];

      for (let j = 0; j < frame.length; j++) {
        const coords = mapEventToXYCoords(frame, j);
        if (!coords) {
          continue;
        }
        markers.push(
          <Marker {...coords} key={`${id}-marker-${i}-${j}`}>
            {renderEventMarker(frame, j)}
          </Marker>
        );
      }
    }

    return <>{markers}</>;
  }, [id, events, renderEventMarker, mapEventToXYCoords, plot, renderToken]);

  if (!hasEventRows(events)) {
    return null;
  }

  return (
    <XYCanvas left={plot.bbox.left / window.devicePixelRatio} top={plot.bbox.top / window.devicePixelRatio}>
      {eventMarkers}
    </XYCanvas>
  );
}
