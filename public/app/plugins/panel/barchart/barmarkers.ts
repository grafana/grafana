import uPlot from 'uplot';

import { MarkerDrawingArgs } from './markerTypes';
import {   useTheme2 } from '@grafana/ui'


export function drawBarMarkers(markers: MarkerDrawingArgs[]) {


  return (u: uPlot) => {
    const ctx = u.ctx;

    if (!ctx) {
      return;
    }
    const lineWidth = ctx.lineWidth;

    ctx.save();

    for (const marker of markers) {
      const { size, shape, fill,color,   strokeWidth } = marker.opts;
      const{ x, y, isRotated } = marker

      ctx.beginPath();

      ctx.globalAlpha = marker.opts.opacity;
      switch (shape) {
        case 'line': {
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeWidth;
          if (isRotated) {
            ctx.moveTo(x, y - size / 2);
            ctx.lineTo(x, y + size / 2);
          } else {
            ctx.moveTo(x - size / 2, y);
            ctx.lineTo(x + size / 2, y);
          }
          ctx.stroke();
          break;
        }
        case 'circle': {
          const radius = size / 2;
          ctx.arc(x, y, Math.max(0, radius), 0, 2 * Math.PI);

          if (fill) {
            ctx.fillStyle = color;
            ctx.fill();
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
          }
          break;
        }
        case 'star': {
          const radius = size / 1.61803398875;

          for (let i = 0; i < 5; i++) {
            const angle = (i * (Math.PI * 2)) / 5 - Math.PI / 2;
            ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));

            const innerAngle = angle + Math.PI / 5;
            ctx.lineTo(x + (radius / 2) * Math.cos(innerAngle), y + (radius / 2) * Math.sin(innerAngle));
          }
          ctx.closePath();

          if (fill) {
            ctx.fillStyle = color;
            ctx.fill();
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
          }
          break;
        }
        case 'cross': {
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeWidth;
          ctx.moveTo(x - size / 2, y - size / 2);
          ctx.lineTo(x + size / 2, y + size / 2);
          ctx.moveTo(x + size / 2, y - size / 2);
          ctx.lineTo(x - size / 2, y + size / 2);
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
