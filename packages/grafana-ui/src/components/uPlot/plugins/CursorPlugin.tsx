import React, { useState, useEffect, useRef, useCallback } from 'react';

import { PlotPluginProps } from '../types';
import { pluginLog } from '../utils';
import { usePlotPluginContext } from '../context';

interface CursorPluginAPI {
  focusedSeriesIdx: number | null;
  focusedPointIdx: number | null;

  coords: {
    // coords relative to plot canvas, css px
    plotCanvas: Coords;
    // coords relative to viewport , css px
    viewport: Coords;
  };
}

interface CursorPluginProps extends PlotPluginProps {
  onMouseMove?: () => void; // anything?
  children: (api: CursorPluginAPI) => React.ReactElement | null;
  // on what interaction position should be captures
  capture?: 'mousemove' | 'mousedown';
  // should the position be persisted when user leaves canvas area
  lock?: boolean;
}

interface Coords {
  x: number;
  y: number;
}

// Exposes API for Graph cursor position
export const CursorPlugin: React.FC<CursorPluginProps> = ({ id, children, capture = 'mousemove', lock = false }) => {
  const pluginId = `CursorPlugin:${id}`;
  const plotCanvas = useRef<HTMLDivElement>(null);
  const plotCanvasBBox = useRef<any>({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
  const pluginsApi = usePlotPluginContext();

  // state exposed to the consumers, maybe better implement as CursorPlugin?
  const [focusedSeriesIdx, setFocusedSeriesIdx] = useState<number | null>(null);
  const [focusedPointIdx, setFocusedPointIdx] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ viewport: Coords; plotCanvas: Coords } | null>(null);

  const clearCoords = useCallback(() => {
    setCoords(null);
  }, [setCoords]);

  useEffect(() => {
    pluginLog(pluginId, true, `Focused series: ${focusedSeriesIdx}, focused point: ${focusedPointIdx}`);
  }, [focusedPointIdx, focusedSeriesIdx]);

  useEffect(() => {
    if (plotCanvas && plotCanvas.current) {
      plotCanvasBBox.current = plotCanvas.current.getBoundingClientRect();
    }
  }, [plotCanvas.current]);

  // on mount - init plugin
  useEffect(() => {
    const onMouseCapture = (e: MouseEvent) => {
      setCoords({
        plotCanvas: {
          x: e.clientX - plotCanvasBBox.current.left,
          y: e.clientY - plotCanvasBBox.current.top,
        },
        viewport: {
          x: e.clientX,
          y: e.clientY,
        },
      });
    };

    const unregister = pluginsApi.registerPlugin({
      id: pluginId,
      hooks: {
        init: u => {
          // @ts-ignore
          plotCanvas.current = u.root.querySelector<HTMLDivElement>('.u-over');
          // @ts-ignore
          plotCanvas.current.addEventListener(capture, onMouseCapture);
          if (!lock) {
            // @ts-ignore
            plotCanvas.current.addEventListener('mouseleave', clearCoords);
          }
        },
        setCursor: u => {
          setFocusedPointIdx(u.cursor.idx === undefined ? null : u.cursor.idx);
        },
        setSeries: (u, idx) => {
          setFocusedSeriesIdx(idx);
        },
      },
    });

    return () => {
      if (plotCanvas && plotCanvas.current) {
        plotCanvas.current.removeEventListener(capture, onMouseCapture);
      }
      unregister();
    };
  }, []);

  // only render children if we are interacting with the canvas
  return coords
    ? children({
        focusedSeriesIdx,
        focusedPointIdx,
        coords,
      })
    : null;
};
