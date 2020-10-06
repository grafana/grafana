import React, { useEffect, useMemo, useState } from 'react';
import { AnnotationEvent } from '@grafana/data';
import { usePlotContext, usePlotPluginContext } from '../context';
import { Marker } from './Marker';
import { XYCanvas } from './XYCanvas';
import { useRefreshAfterGraphRendered } from '../hooks';

interface EventsCanvasProps<T> {
  id: string;
  events: T[];
  renderEventMarker: (event: T) => React.ReactNode;
  mapEventToXYCoords: (event: T) => { x: number; y: number } | undefined;
}

export function EventsCanvas<T extends AnnotationEvent>({
  id,
  events,
  renderEventMarker,
  mapEventToXYCoords,
}: EventsCanvasProps<T>) {
  const plotContext = usePlotContext();
  const renderToken = useRefreshAfterGraphRendered(id);

  const eventMarkers = useMemo(() => {
    console.log('invalidating markers');
    if (!plotContext || !plotContext?.u) {
      return null;
    }
    const markers: AnnotationEvent[] = [];

    if (!events) {
      return markers;
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      const coords = mapEventToXYCoords(event);

      if (!coords) {
        continue;
      }

      markers.push(
        <Marker {...coords} key={`${event.time}-${i}`}>
          {renderEventMarker(event)}
        </Marker>
      );
    }

    return <>{markers}</>;
  }, [events, renderEventMarker, plotContext, renderToken]);

  if (!plotContext || !plotContext.u || !plotContext.canvas) {
    return null;
  }
  return <XYCanvas>{eventMarkers}</XYCanvas>;
}
