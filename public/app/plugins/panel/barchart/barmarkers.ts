
import { UPlotConfigBuilder } from '@grafana/ui';
import uPlot from 'uplot';
import { ResolvedMarker, BarMarkerOpts } from './markerTypes';

// Minimal, plugin-scoped marker drawing utilities.
// This module exports a factory `singleBarMarker(builder)` that returns a `draw` hook
// for uPlot. The hook currently draws demo horizontal ticks; later we'll resolve
// positions from prepData and panel options.




export type BarMarker = {
  opts: BarMarkerOpts;
  y?: number; // pixel y position (demo only)
  x?: string | number | null; // canonical x value to resolve at draw time
};

export const demoMarkers: BarMarker[] = [
  { opts: { label: 'M1', width: 80, color: '#d9534f', shape: "line", isRotated: false }, y: 40, x: 200 },
  { opts: { label: 'M2', width: 80, color: '#5bc0de', shape: "line", isRotated: false }, y: 40, x: 420 },
];

/**
 * Return a `draw` hook that paints demo markers. The hook signature matches uPlot's
 * draw hook: (u: uPlot) => void.
 */
export function singleBarMarker(_builder: UPlotConfigBuilder, markers: ResolvedMarker[]) {
  return function drawMarkers(u: uPlot) {
    const ctx = u.ctx;
    if (!ctx) {
      return;
    }

    ctx.save();

    const markersToDraw: ResolvedMarker[] = [];

    // prefer persisted markers if provided
    if (markers && Array.isArray(markers) && markers.length > 0) {
      for (const m of markers) {
        markersToDraw.push(m);
      }
    }
    for (const m of markersToDraw) {
     
      const width = m.opts?.width ?? 60;
      const color = m.opts?.color ?? '#ff0000ff';

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      if (typeof m.x === 'number' && typeof m.y === 'number') {
        ctx.beginPath();
        ctx.moveTo(m.x - width / 2, m.y);
        ctx.lineTo(m.x + width / 2, m.y);
        ctx.stroke();
      }

      if (m.opts?.label) {
        ctx.fillStyle = color;
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(m.opts.label, m.x + width / 2, m.y - 15);
      }
    }

    ctx.restore();
  };
}
