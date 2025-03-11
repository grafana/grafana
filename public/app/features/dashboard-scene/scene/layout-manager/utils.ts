import { SceneLayout, SceneObject } from '@grafana/scenes';

import { DashboardLayoutItem } from '../types/DashboardLayoutItem';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface DropZone extends Rect {
  /* The two-dimensional euclidean distance, in pixels, between the drop zone and some reference point (usually cursor position) */
  distanceToPoint: number;
}

export interface SceneLayout2 extends SceneLayout {
  closestDropZone(cursorPosition: Point): DropZone;
  importLayoutItem(layoutItem: DashboardLayoutItem): void;
  removeLayoutItem(layoutItem: DashboardLayoutItem): void;
}

// todo@kay: Not the most robust interface check, should make more robust.
export function isSceneLayout(o: SceneObject): o is SceneLayout2 {
  return typeof (o as any).isDraggable === 'function' && typeof (o as any).closestDropZone === 'function';
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

/** Walks up the scene graph, returning the first non-undefined result of `extract` */
export function closestOfType<T extends SceneObject>(
  sceneObject: SceneObject,
  objectIsOfType: (s: SceneObject) => s is T
): T | undefined {
  let curSceneObject: SceneObject | undefined = sceneObject;

  while (curSceneObject && !objectIsOfType(curSceneObject)) {
    curSceneObject = curSceneObject.parent;
  }

  return curSceneObject;
}

export function closestScroll(el?: HTMLElement | null): number {
  if (el && el.scrollTop > 0) {
    return el.scrollTop;
  }

  return el ? closestScroll(el.parentElement) : 0;
}

export function shortestDistanceToLine(point: Point, line: [Point, Point]) {
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
