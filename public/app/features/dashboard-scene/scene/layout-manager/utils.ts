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

export interface SceneLayoutWithDragAndDrop extends SceneLayout {
  closestDropZone(cursorPosition: Point): DropZone;
  importLayoutItem(layoutItem: DashboardLayoutItem): void;
  removeLayoutItem(layoutItem: DashboardLayoutItem): void;
}

// todo@kay: Not the most robust interface check, should make more robust.
export function isSceneLayoutWithDragAndDrop(o: SceneObject): o is SceneLayoutWithDragAndDrop {
  return (
    'isDraggable' in o &&
    'closestDropZone' in o &&
    typeof o.isDraggable === 'function' &&
    typeof o.closestDropZone === 'function'
  );
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
