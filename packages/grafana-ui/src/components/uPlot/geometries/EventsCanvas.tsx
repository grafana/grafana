import React, { useMemo } from 'react';
import { DataFrame, DataFrameView } from '@grafana/data';
import { usePlotContext } from '../context';
import { Marker } from './Marker';
import { XYCanvas } from './XYCanvas';
import { useRefreshAfterGraphRendered } from '../hooks';

interface EventsCanvasProps<T> {
  id: string;
  events: DataFrame[];
  renderEventMarker: (event: T) => React.ReactNode;
  mapEventToXYCoords: (event: T) => { x: number; y: number } | undefined;
}

export function EventsCanvas<T>({ id, events, renderEventMarker, mapEventToXYCoords }: EventsCanvasProps<T>) {
  const plotCtx = usePlotContext();
  const renderToken = useRefreshAfterGraphRendered(id);

  const eventMarkers = useMemo(() => {
    const markers: React.ReactNode[] = [];

    if (!plotCtx.isPlotReady || events.length === 0) {
      return markers;
    }

    for (let i = 0; i < events.length; i++) {
      const view = new DataFrameView<T>(events[i]);
      for (let j = 0; j < view.length; j++) {
        const event = view.get(j);

        const coords = mapEventToXYCoords(event);
        if (!coords) {
          continue;
        }
        markers.push(
          <Marker {...coords} key={`${id}-marker-${i}-${j}`}>
            {renderEventMarker(event)}
          </Marker>
        );
      }
    }

    return <>{markers}</>;
  }, [events, renderEventMarker, renderToken, plotCtx.isPlotReady]);

  if (!plotCtx.isPlotReady) {
    return null;
  }

  return <XYCanvas>{eventMarkers}</XYCanvas>;
}
