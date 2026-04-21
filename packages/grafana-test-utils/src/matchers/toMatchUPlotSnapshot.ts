import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { type Context, toMatchSnapshot } from 'jest-snapshot';

export type ToMatchSnapshotRest = Parameters<typeof toMatchSnapshot> extends [unknown, ...infer R] ? R : never;

type SnapshotMismatch = jest.CustomMatcherResult & {
  expected?: string;
};

export function toMatchUPlotSnapshot(
  this: Context,
  received: CanvasRenderingContext2DEvent[],
  data: uPlot.AlignedData,
  series?: uPlot.Series[],
  debug = false,
  ...rest: ToMatchSnapshotRest
): jest.CustomMatcherResult {
  const result = toMatchSnapshot.call(this, received, ...rest) as SnapshotMismatch; // @todo how to properly get actual from jest?

  if (!result.pass && result.expected != null) {
    const parsedExpected = parseSnapshotJson(result.expected) as CanvasRenderingContext2DEvent[];
    const expectedCanvasCalls = eventsToCanvasScript(parsedExpected, 'expected');
    const receivedCanvasCalls = eventsToCanvasScript(received, 'actual');
    const expectedUrlParam = encodeURIComponent(expectedCanvasCalls);
    const actualUrlParam = encodeURIComponent(receivedCanvasCalls);
    const dataUrlParam = encodeURIComponent(JSON.stringify(data));
    const seriesUrlParam = series ? encodeURIComponent(JSON.stringify(series)) : '';
    // @todo codepen hits URL length limits, local?
    console.log(
      `https://codepen.io/gtk-dev/pen/emdoxvB?expected=${expectedUrlParam}&actual=${actualUrlParam}&uPlotData=${dataUrlParam}&uPlotSeries=${seriesUrlParam}`
    );
  }

  return result;
}

export function parseSnapshotJson(text: string) {
  const withoutTrailingCommas = text.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}

export function eventsToCanvasScript(data: CanvasRenderingContext2DEvent[], canvasId: string) {
  const lines: string[] = [];
  for (const ev of data) {
    emitOne(ev, canvasId, lines);
  }
  return lines.join('\n');
}

function emitOne(event: CanvasRenderingContext2DEvent, ctx: string, lines: string[]) {
  const { type, props = {} } = event;

  switch (type) {
    case 'save':
      lines.push(`${ctx}.save();`);
      return;
    case 'restore':
      lines.push(`${ctx}.restore();`);
      return;
    case 'beginPath':
      lines.push(`${ctx}.beginPath();`);
      return;
    case 'closePath':
      lines.push(`${ctx}.closePath();`);
      return;
    case 'resetTransform':
      lines.push(`${ctx}.resetTransform();`);
      return;
    case 'clearHitRegions':
      lines.push(`${ctx}.clearHitRegions();`);
      return;
    case 'clearRect':
      lines.push(`${ctx}.clearRect(${props.x}, ${props.y}, ${props.width}, ${props.height});`);
      return;
    case 'fillRect':
      lines.push(`${ctx}.fillRect(${props.x}, ${props.y}, ${props.width}, ${props.height});`);
      return;
    case 'strokeRect':
      lines.push(`${ctx}.strokeRect(${props.x}, ${props.y}, ${props.width}, ${props.height});`);
      return;
    case 'rect':
      lines.push(`${ctx}.rect(${props.x}, ${props.y}, ${props.width}, ${props.height});`);
      return;
    case 'moveTo':
      lines.push(`${ctx}.moveTo(${props.x}, ${props.y});`);
      return;
    case 'lineTo':
      lines.push(`${ctx}.lineTo(${props.x}, ${props.y});`);
      return;
    case 'arc':
      lines.push(
        `${ctx}.arc(${props.x}, ${props.y}, ${props.radius}, ${props.startAngle}, ${
          props.endAngle
        }, ${props.anticlockwise});`
      );
      return;
    case 'arcTo':
      lines.push(`${ctx}.arcTo(${props.cpx1}, ${props.cpy1}, ${props.cpx2}, ${props.cpy2}, ${props.radius});`);
      return;
    case 'ellipse':
      lines.push(
        `${ctx}.ellipse(${props.x}, ${props.y}, ${props.radiusX}, ${
          props.radiusY
        }, ${props.rotation}, ${props.startAngle}, ${props.endAngle}, ${props.anticlockwise});`
      );
      return;
    case 'bezierCurveTo':
      lines.push(
        `${ctx}.bezierCurveTo(${props.cpx1}, ${props.cpy1}, ${props.cpx2}, ${props.cpy2}, ${props.x}, ${props.y});`
      );
      return;
    case 'quadraticCurveTo':
      lines.push(`${ctx}.quadraticCurveTo(${props.cpx}, ${props.cpy}, ${props.x}, ${props.y});`);
      return;

    case 'translate':
      lines.push(`${ctx}.translate(${props.x}, ${props.y});`);
      return;
    case 'rotate':
      lines.push(`${ctx}.rotate(${props.angle});`);
      return;
    case 'scale':
      lines.push(`${ctx}.scale(${props.x}, ${props.y});`);
      return;
    case 'transform':
      lines.push(`${ctx}.transform(${props.a}, ${props.b}, ${props.c}, ${props.d}, ${props.e}, ${props.f});`);
      return;
    case 'setTransform':
      lines.push(`${ctx}.setTransform(${props.a}, ${props.b}, ${props.c}, ${props.d}, ${props.e}, ${props.f});`);
      return;
    case 'currentTransform':
      lines.push(
        `// ${ctx}.setTransform via currentTransform — use DOMMatrix or setTransform:\n` +
          `${ctx}.setTransform(${props.a}, ${props.b}, ${props.c}, ${props.d}, ${props.e}, ${props.f});`
      );
      return;

    case 'clip': {
      const p = props.path;
      const fillRule = props.fillRule ?? 'nonzero';
      emitSubpath(p, ctx, lines);
      lines.push(`${ctx}.clip("${fillRule}");`);
      return;
    }
    case 'fill': {
      const p = props.path;
      const fillRule = props.fillRule ?? 'nonzero';
      emitSubpath(p, ctx, lines);
      lines.push(`${ctx}.fill("${fillRule}");`);
      return;
    }
    case 'stroke': {
      const p = props.path;
      emitSubpath(p, ctx, lines);
      lines.push(`${ctx}.stroke();`);
      return;
    }

    case 'fillText': {
      const mw = props.maxWidth;
      if (mw == null) {
        lines.push(`${ctx}.fillText("${props.text}", ${props.x}, ${props.y});`);
      } else {
        lines.push(`${ctx}.fillText("${props.text}", ${props.x}, ${props.y}, ${mw});`);
      }
      return;
    }
    case 'strokeText': {
      const mw = props.maxWidth;
      if (mw == null) {
        lines.push(`${ctx}.strokeText("${props.text}", ${props.x}, ${props.y});`);
      } else {
        lines.push(`${ctx}.strokeText("${props.text}", ${props.x}, ${props.y}, ${mw});`);
      }
      return;
    }
    case 'measureText':
      lines.push(`${ctx}.measureText("${props.text}");`);
      return;

    case 'setLineDash': {
      const segs = props.segments;
      if (segs && Array.isArray(segs) && segs.length) {
        lines.push(`${ctx}.setLineDash(${segs});`);
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
    case 'imageSmoothingQuay':
    case 'shadowBlur':
    case 'shadowColor':
    case 'shadowOffsetX':
    case 'shadowOffsetY': {
      const value = typeof props.value === 'number' ? props.value : `"${props.value.replaceAll('"', '\\"')}"`;
      lines.push(`${ctx}.${type} = ${value};`);
      return;
    }
    case 'createLinearGradient':
      lines.push(`${ctx}.createLinearGradient(${props.x0}, ${props.y0}, ${props.x1}, ${props.y1});`);
      return;
    case 'createRadialGradient':
      lines.push(
        `${ctx}.createRadialGradient(${props.x0}, ${props.y0}, ${props.r0}, ${props.x1}, ${props.y1}, ${props.r1});`
      );
      return;
    case 'createPattern':
      lines.push(`// createPattern: image not in snapshot\n${ctx}.createPattern(image, ${props.type});`);
      return;
    case 'createImageData': {
      lines.push(`${ctx}.createImageData(${props.width}, ${props.height});`);
      return;
    }
    case 'isPointInPath': {
      const p = props.path;
      lines.push(`${ctx}.beginPath();`);
      if (Array.isArray(p)) {
        for (const seg of p) {
          emitPathBuilding(seg, ctx, lines);
        }
      }
      lines.push(`${ctx}.isPointInPath(${props.x}, ${props.y}, "${props.fillRule ?? 'nonzero'}");`);
      return;
    }

    case 'addHitRegion':
    case 'removeHitRegion':
    case 'drawFocusIfNeeded':
    case 'scrollPathIntoView':
      lines.push(`// ${type}: ${props}`);
      return;

    default:
      throw new Error(`Unhandled event type: ${type}: ${props}`);
  }
}

function emitSubpath(pathEvents: CanvasRenderingContext2DEvent[], ctx: string, lines: string[]) {
  if (!Array.isArray(pathEvents) || pathEvents.length === 0) {
    return;
  }
  const startsWithBegin = pathEvents[0]?.type === 'beginPath';
  if (!startsWithBegin) {
    lines.push(`${ctx}.beginPath();`);
  }
  for (const seg of pathEvents) {
    emitPathBuilding(seg, ctx, lines);
  }
}

function emitPathBuilding(ev: CanvasRenderingContext2DEvent, ctx: string, lines: string[]) {
  const { type, props = {} } = ev;
  switch (type) {
    case 'beginPath':
      lines.push(`${ctx}.beginPath();`);
      break;
    case 'closePath':
      lines.push(`${ctx}.closePath();`);
      break;
    case 'moveTo':
      lines.push(`${ctx}.moveTo(${props.x}, ${props.y});`);
      break;
    case 'lineTo':
      lines.push(`${ctx}.lineTo(${props.x}, ${props.y});`);
      break;
    case 'rect':
      lines.push(`${ctx}.rect(${props.x}, ${props.y}, ${props.width}, ${props.height});`);
      break;
    case 'arc':
      lines.push(
        `${ctx}.arc(${props.x}, ${props.y}, ${props.radius}, ${props.startAngle}, ${
          props.endAngle
        }, ${props.anticlockwise});`
      );
      break;
    case 'arcTo':
      lines.push(`${ctx}.arcTo(${props.cpx1}, ${props.cpy1}, ${props.cpx2}, ${props.cpy2}, ${props.radius});`);
      break;
    case 'ellipse':
      lines.push(
        `${ctx}.ellipse(${props.x}, ${props.y}, ${props.radiusX}, ${
          props.radiusY
        }, ${props.rotation}, ${props.startAngle}, ${props.endAngle}, ${props.anticlockwise});`
      );
      break;
    case 'bezierCurveTo':
      lines.push(
        `${ctx}.bezierCurveTo(${props.cpx1}, ${props.cpy1}, ${props.cpx2}, ${props.cpy2}, ${props.x}, ${props.y});`
      );
      break;
    case 'quadraticCurveTo':
      lines.push(`${ctx}.quadraticCurveTo(${props.cpx}, ${props.cpy}, ${props.x}, ${props.y});`);
      break;
    case 'clip': {
      const p = props.path;
      const fillRule = props.fillRule ?? 'nonzero';
      lines.push(`${ctx}.beginPath();`);
      if (Array.isArray(p)) {
        for (const seg of p) {
          emitPathBuilding(seg, ctx, lines);
        }
      }
      lines.push(`${ctx}.clip("${fillRule}");`);
      break;
    }
    default:
      throw new Error(`Unhandled path segment: ${ev}`);
  }
}
