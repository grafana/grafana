import uPlot from 'uplot';

import { UPlotConfigBuilder } from '@grafana/ui';

import { ResolvedMarker, BarMarkerOpts } from './markerTypes';

export type BarMarker = {
  opts: BarMarkerOpts;
  y: number; // pixel y position
  x: number; // pixel x position
};

export function drawBarMarkers(_builder: UPlotConfigBuilder, markers: ResolvedMarker[]) {
  return function drawMarkers(u: uPlot) {
    const ctx = u.ctx;

    if (!ctx) {
      return;
    }
    const lineWidth = ctx.lineWidth;

    ctx.save();

    for (const m of markers) {
      if (!m.opts) {
        continue;
      }
      const { width, shape, isRotated, color = '#ff0000ff' } = m.opts;
      const x = m.x;
      const y = m.y;

      if (typeof x !== 'number' || typeof y !== 'number') {
        continue;
      }

      ctx.beginPath();

      ctx.globalAlpha = m.opts.opacity;
      switch (shape) {
        case 'line': {
          ctx.strokeStyle = color;
          ctx.lineWidth = width / 32 + 2;
          if (isRotated) {
            ctx.moveTo(x, y - width / 2);
            ctx.lineTo(x, y + width / 2);
          } else {
            ctx.moveTo(x - width / 2, y);
            ctx.lineTo(x + width / 2, y);
          }
          ctx.stroke();
          break;
        }
        case 'circle': {
          const radius = width / 2;
          ctx.arc(x, y, Math.max(0, radius - (width > 15 ? width / 16 : 0)), 0, 2 * Math.PI);

          if (width > 15) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width / 8;
            ctx.stroke();
          } else {
            ctx.fillStyle = color;
            ctx.fill();
          }
          break;
        }
        case 'star': {
          const radius = width ? width / 1.61803398875 : 10;
          const isSmall = width ? width < 15 : false;

          for (let i = 0; i < 5; i++) {
            const angle = (i * (Math.PI * 2)) / 5 - Math.PI / 2;
            ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
            const innerAngle = angle + Math.PI / 5;
            ctx.lineTo(x + (radius / 2) * Math.cos(innerAngle), y + (radius / 2) * Math.sin(innerAngle));
          }
          ctx.closePath();

          if (isSmall) {
            ctx.fillStyle = color;
            ctx.fill();
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = width ? width / 8 : 3;
            ctx.stroke();
          }
          break;
        }
        case 'cross': {
          ctx.strokeStyle = color;
          ctx.lineWidth = width / 12 + 2;
          ctx.moveTo(x - width / 2, y - width / 2);
          ctx.lineTo(x + width / 2, y + width / 2);
          ctx.moveTo(x + width / 2, y - width / 2);
          ctx.lineTo(x - width / 2, y + width / 2);
          ctx.stroke();
          break;
        }
        default:
          break;
      }
      ctx.lineWidth = lineWidth;
      ctx.restore();
    }
  };
}
