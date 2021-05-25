import { DataFrame, DataFrameFieldIndex } from '@grafana/data';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { usePlotContext } from '../context';
import { Marker } from './Marker';
import { XYCanvas } from './XYCanvas';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

interface EventsCanvasProps {
  id: string;
  config: UPlotConfigBuilder;
  events: DataFrame[];
  renderEventMarker: (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => React.ReactNode;
  mapEventToXYCoords: (
    dataFrame: DataFrame,
    dataFrameFieldIndex: DataFrameFieldIndex
  ) => { x: number; y: number } | undefined;
}

export function EventsCanvas({ id, events, renderEventMarker, mapEventToXYCoords, config }: EventsCanvasProps) {
  const plotCtx = usePlotContext();
  // render token required to re-render annotation markers. Rendering lines happens in uPlot and the props do not change
  // so we need to force the re-render when the draw hook was performed by uPlot
  const [renderToken, setRenderToken] = useState(0);

  useLayoutEffect(() => {
    config.addHook('draw', () => {
      setRenderToken((s) => s + 1);
    });
  }, [config, setRenderToken]);

  const eventMarkers = useMemo(() => {
    const markers: React.ReactNode[] = [];
    const plotInstance = plotCtx.plot;
    if (!plotInstance || events.length === 0) {
      return markers;
    }

    for (let i = 0; i < events.length; i++) {
      const frame = events[i];
      for (let j = 0; j < frame.length; j++) {
        const coords = mapEventToXYCoords(frame, { fieldIndex: j, frameIndex: i });
        if (!coords) {
          continue;
        }
        markers.push(
          <Marker {...coords} key={`${id}-marker-${i}-${j}`}>
            {renderEventMarker(frame, { fieldIndex: j, frameIndex: i })}
          </Marker>
        );
      }
    }

    return <>{markers}</>;
  }, [events, renderEventMarker, renderToken, plotCtx]);

  if (!plotCtx.plot) {
    return null;
  }

  return <XYCanvas>{eventMarkers}</XYCanvas>;
}
