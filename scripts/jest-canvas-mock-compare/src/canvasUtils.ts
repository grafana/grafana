import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';

/**
 * @param data
 * @param ctx
 */
export function eventsToCanvasScript(data: CanvasRenderingContext2DEvent[], ctx: CanvasRenderingContext2D) {
  for (const ev of data) {
    emitOne(ev, ctx);
  }
}

function emitOne(event: CanvasRenderingContext2DEvent, ctx: CanvasRenderingContext2D) {
  const { type, props = {} } = event;

  switch (type) {
    case 'save':
      ctx.save();
      return;
    case 'restore':
      ctx.restore();
      return;
    case 'beginPath':
      ctx.beginPath();
      return;
    case 'closePath':
      ctx.closePath();
      return;
    case 'resetTransform':
      ctx.resetTransform();
      return;
    case 'clearRect':
      ctx.clearRect(props.x, props.y, props.width, props.height);
      return;
    case 'fillRect':
      ctx.fillRect(props.x, props.y, props.width, props.height);
      return;
    case 'strokeRect':
      ctx.strokeRect(props.x, props.y, props.width, props.height);
      return;
    case 'rect':
      ctx.rect(props.x, props.y, props.width, props.height);
      return;
    case 'moveTo':
      ctx.moveTo(props.x, props.y);
      return;
    case 'lineTo':
      ctx.lineTo(props.x, props.y);
      return;
    case 'arc':
      ctx.arc(props.x, props.y, props.radius, props.startAngle, props.endAngle, props.anticlockwise);
      return;
    case 'arcTo':
      ctx.arcTo(props.cpx1, props.cpy1, props.cpx2, props.cpy2, props.radius);
      return;
    case 'ellipse':
      ctx.ellipse(
        props.x,
        props.y,
        props.radiusX,
        props.radiusY,
        props.rotation,
        props.startAngle,
        props.endAngle,
        props.anticlockwise
      );
      return;
    case 'bezierCurveTo':
      ctx.bezierCurveTo(props.cpx1, props.cpy1, props.cpx2, props.cpy2, props.x, props.y);
      return;
    case 'quadraticCurveTo':
      ctx.quadraticCurveTo(props.cpx, props.cpy, props.x, props.y);
      return;

    case 'translate':
      ctx.translate(props.x, props.y);
      return;
    case 'rotate':
      ctx.rotate(props.angle);
      return;
    case 'scale':
      ctx.scale(props.x, props.y);
      return;
    case 'transform':
      ctx.transform(props.a, props.b, props.c, props.d, props.e, props.f);
      return;
    case 'setTransform':
      ctx.setTransform(props.a, props.b, props.c, props.d, props.e, props.f);
      return;
    case 'currentTransform':
      ctx.setTransform(props.a, props.b, props.c, props.d, props.e, props.f);
      return;

    case 'clip': {
      const p = props.path;
      const fillRule = props.fillRule ?? 'nonzero';
      if (!Array.isArray(p) || p.length === 0) {
        // Empty path: must not reuse the context's current path (jest-canvas-mock encodes
        // `ctx.clip(emptyPath)` this way; clipping to an empty subpath is a no-op in practice).
        ctx.beginPath();
        ctx.clip(fillRule);
        return;
      }
      emitSubpath(p, ctx);
      ctx.clip(fillRule);
      return;
    }
    case 'fill': {
      const p = props.path;
      const fillRule = props.fillRule ?? 'nonzero';
      if (!Array.isArray(p) || p.length === 0) {
        // `ctx.fill(emptyPath2D)` is a no-op. Replaying `fill()` without rebuilding the path
        // would incorrectly re-fill the *previous* path (see jest-canvas-mock-compare with candlestick
        // drawMarkers: flat + hollowPath empty segments).
        ctx.beginPath();
        ctx.fill(fillRule);
        return;
      }
      emitSubpath(p, ctx);
      ctx.fill(fillRule);
      return;
    }
    case 'stroke': {
      const p = props.path;
      if (!Array.isArray(p) || p.length === 0) {
        ctx.beginPath();
        ctx.stroke();
        return;
      }
      emitSubpath(p, ctx);
      ctx.stroke();
      return;
    }

    case 'fillText': {
      const mw = props.maxWidth;
      if (mw == null) {
        ctx.fillText(props.text, props.x, props.y);
      } else {
        ctx.fillText(props.text, props.x, props.y, mw);
      }
      return;
    }
    case 'strokeText': {
      const mw = props.maxWidth;
      if (mw == null) {
        ctx.strokeText(props.text, props.x, props.y);
      } else {
        ctx.strokeText(props.text, props.x, props.y, mw);
      }
      return;
    }
    case 'measureText':
      ctx.measureText(props.text);
      return;

    case 'setLineDash': {
      const segs = props.segments;
      if (segs && Array.isArray(segs) && segs.length) {
        ctx.setLineDash(segs);
      }
      return;
    }
    case 'fillStyle':
    case 'strokeStyle':
    case 'globalAlpha':
    case 'globalCompositeOperation':
    case 'lineWidth':
    case 'lineCap':
    case 'lineJoin':
    case 'miterLimit':
    case 'lineDashOffset':
    case 'font':
    case 'textAlign':
    case 'textBaseline':
    case 'filter':
    case 'direction':
    case 'imageSmoothingEnabled':
    case 'imageSmoothingQuality':
    case 'shadowBlur':
    case 'shadowColor':
    case 'shadowOffsetX':
    case 'shadowOffsetY': {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (ctx as unknown as Record<string, unknown>)[type] = props.value;
      return;
    }
    case 'createLinearGradient':
      ctx.createLinearGradient(props.x0, props.y0, props.x1, props.y1);
      return;
    case 'createRadialGradient':
      ctx.createRadialGradient(props.x0, props.y0, props.r0, props.x1, props.y1, props.r1);
      return;
    case 'createPattern':
      // Image source is not captured in the snapshot payload.
      return;
    case 'createImageData': {
      ctx.createImageData(props.width, props.height);
      return;
    }
    case 'isPointInPath': {
      const p = props.path;
      ctx.beginPath();
      if (Array.isArray(p)) {
        for (const seg of p) {
          emitPathBuilding(seg, ctx);
        }
      }
      ctx.isPointInPath(props.x, props.y, props.fillRule ?? 'nonzero');
      return;
    }

    case 'addHitRegion':
    case 'removeHitRegion':
    case 'drawFocusIfNeeded':
    case 'scrollPathIntoView':
      return;

    default:
      throw new Error(`Unhandled event type: ${type}: ${props}`);
  }
}

function emitSubpath(pathEvents: CanvasRenderingContext2DEvent[], ctx: CanvasRenderingContext2D) {
  if (!Array.isArray(pathEvents) || pathEvents.length === 0) {
    return;
  }
  const startsWithBegin = pathEvents[0]?.type === 'beginPath';
  if (!startsWithBegin) {
    ctx.beginPath();
  }
  for (const seg of pathEvents) {
    emitPathBuilding(seg, ctx);
  }
}

function emitPathBuilding(ev: CanvasRenderingContext2DEvent, ctx: CanvasRenderingContext2D) {
  const { type, props = {} } = ev;
  switch (type) {
    case 'beginPath':
      ctx.beginPath();
      break;
    case 'closePath':
      ctx.closePath();
      break;
    case 'moveTo':
      ctx.moveTo(props.x, props.y);
      break;
    case 'lineTo':
      ctx.lineTo(props.x, props.y);
      break;
    case 'rect':
      ctx.rect(props.x, props.y, props.width, props.height);
      break;
    case 'arc':
      ctx.arc(props.x, props.y, props.radius, props.startAngle, props.endAngle, props.anticlockwise);
      break;
    case 'arcTo':
      ctx.arcTo(props.cpx1, props.cpy1, props.cpx2, props.cpy2, props.radius);
      break;
    case 'ellipse':
      ctx.ellipse(
        props.x,
        props.y,
        props.radiusX,
        props.radiusY,
        props.rotation,
        props.startAngle,
        props.endAngle,
        props.anticlockwise
      );
      break;
    case 'bezierCurveTo':
      ctx.bezierCurveTo(props.cpx1, props.cpy1, props.cpx2, props.cpy2, props.x, props.y);
      break;
    case 'quadraticCurveTo':
      ctx.quadraticCurveTo(props.cpx, props.cpy, props.x, props.y);
      break;
    case 'clip': {
      const p = props.path;
      const fillRule = props.fillRule ?? 'nonzero';
      ctx.beginPath();
      if (Array.isArray(p)) {
        for (const seg of p) {
          emitPathBuilding(seg, ctx);
        }
      }
      ctx.clip(fillRule);
      break;
    }
    default:
      throw new Error(`Unhandled path segment: ${ev}`);
  }
}
