import { DataFrame } from '@grafana/data';
import React, { useMemo } from 'react';
import { usePlotContext } from '../context';
import { useRefreshAfterGraphRendered } from '../hooks';
import { Marker } from './Marker';
import { XYCanvas } from './XYCanvas';

interface EventsCanvasProps {
  id: string;
  events: DataFrame[];
  renderEventMarker: (dataFrame: DataFrame, index: number) => React.ReactNode;
  mapEventToXYCoords: (dataFrame: DataFrame, index: number) => { x: number; y: number } | undefined;
}

export function EventsCanvas({ id, events, renderEventMarker, mapEventToXYCoords }: EventsCanvasProps) {
  const plotCtx = usePlotContext();
  const renderToken = useRefreshAfterGraphRendered(id);

  const eventMarkers = useMemo(() => {
    const markers: React.ReactNode[] = [];
    if (!plotCtx.getPlotInstance() || events.length === 0) {
      return markers;
    }

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
  }, [events, renderEventMarker, renderToken, plotCtx]);

  if (!plotCtx.getPlotInstance()) {
    return null;
  }

  return <XYCanvas>{eventMarkers}</XYCanvas>;
}
