import { sceneGraph, SceneLayout, SceneObject } from '@grafana/scenes';

import { DropZone } from './DragManager';

export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  rowIndex: number;
  columnIndex: number;
  order: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SceneLayout2 extends SceneLayout {
  getDropZones: () => Rect[];
}

// Not the most robust interface check. todo?
export function isSceneLayout(o: SceneObject): o is SceneLayout2 {
  return typeof (o as any).isDraggable === 'function' && typeof (o as any).getDropZones === 'function';
}

/** Walks up the scene graph, returning the first non-undefined result of `extract` */
export function getClosest<T>(sceneObject: SceneObject, extract: (s: SceneObject) => T | undefined): T | undefined {
  let curSceneObject: SceneObject | undefined = sceneObject;
  let extracted: T | undefined = undefined;

  while (curSceneObject && !extracted) {
    extracted = extract(curSceneObject);
    curSceneObject = curSceneObject.parent;
  }

  return extracted;
}

/** Given an array of rectangles and a point, calculate the rectangle closest to the point */
export function closestCell(root: SceneObject, rects: DropZone[], point: Point) {
  const scrollTopMap: Record<string, number> = {};
  for (const rect of rects) {
    const layout = sceneGraph.findByKey(root, rect.layoutKey) as SceneLayout2 | undefined;
    if (layout && 'getContainer' in layout && typeof layout['getContainer'] === 'function') {
      scrollTopMap[rect.layoutKey] = closestScroll(layout.getContainer());
    }
  }

  let closest = rects[0];
  let shortestDistance = Number.MAX_SAFE_INTEGER;
  let offset: Point = { x: 0, y: 0 };
  let scrollTop = 0;
  let from = 'top';
  for (const rect of rects) {
    const topLeft = { x: rect.left, y: rect.top };
    const topRight = { x: rect.right, y: rect.top };
    const bottomLeft = { x: rect.left, y: rect.bottom };
    const bottomRight = { x: rect.right, y: rect.bottom };
    const lines: Array<{ points: [Point, Point]; id: string }> = [
      { points: [topLeft, topRight], id: 'top' },
      { points: [topLeft, bottomLeft], id: 'left' },
      { points: [bottomLeft, bottomRight], id: 'bottom' },
      { points: [topRight, bottomRight], id: 'right' },
    ];

    for (const line of lines) {
      const distance = shortestDistanceToLine({ x: point.x, y: point.y + scrollTopMap[rect.layoutKey] }, line.points);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        closest = rect;
        scrollTop = scrollTopMap[rect.layoutKey];
        from = line.id;
        offset = { x: topLeft.x - point.x, y: topLeft.y - point.y - scrollTopMap[rect.layoutKey] };
      }
    }
  }

  return { closest, offset, scrollTop, from };
}

function closestScroll(el?: HTMLElement | null): number {
  if (el && el.scrollTop > 0) {
    return el.scrollTop;
  }

  return el ? closestScroll(el.parentElement) : 0;
}

function shortestDistanceToLine(point: Point, line: [Point, Point]) {
  const [{ x: x1, y: y1 }, { x: x2, y: y2 }] = line;
  const { x, y } = point;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const dotProduct = (x - x1) * dx + (y - y1) * dy;
  const lengthSquared = dx * dx + dy * dy;
  const param = dotProduct / lengthSquared;

  let xx = x1 + param * dx;
  let yy = y1 + param * dy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  }

  const xDistance = x - xx;
  const yDistance = y - yy;
  return Math.hypot(xDistance, yDistance);
}
