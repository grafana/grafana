import { type CSSProperties } from 'react';

import { type ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { type RootElement } from 'app/features/canvas/runtime/root';

import { type DragNode, type DropNode } from '../../types';

export interface TreeElement {
  key: number;
  title: string;
  selectable?: boolean;
  children?: TreeElement[];
  style?: CSSProperties;
}

// Resolve a tree node back to its live element by UID. Tree nodes intentionally do NOT
// hold a reference to the ElementState: rc-tree caches node data internally (keyEntities),
// so a stored element reference would survive deletion and keep the element (and its
// detached DOM) from being garbage-collected. Look it up from the scene on demand instead.
export function findElementByUID(
  root: RootElement | FrameState | undefined,
  uid: number
): ElementState | FrameState | undefined {
  if (!root) {
    return undefined;
  }
  for (const item of root.elements) {
    if (item.UID === uid) {
      return item;
    }
    if (item instanceof FrameState) {
      const found = findElementByUID(item, uid);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

type TreeElementCallback = (item: TreeElement, index: number, arr: TreeElement[]) => void;

// A signature of the current element tree (UIDs in order). Scene.root is a stable
// reference whose .elements mutate in place, so a rebuild effect cannot key on it.
// Without this, deleting an element leaves stale tree nodes holding dataRef -> the
// deleted ElementState, which keeps it (and its detached DOM) from being collected.
export function getTreeStructureKey(root?: RootElement | FrameState): string {
  if (!root) {
    return '';
  }
  const parts: string[] = [];
  const walk = (frame: RootElement | FrameState) => {
    for (const item of frame.elements) {
      parts.push(String(item.UID));
      if (item instanceof FrameState) {
        parts.push('[');
        walk(item);
        parts.push(']');
      }
    }
  };
  walk(root);
  return parts.join(',');
}

export function getTreeData(root?: RootElement | FrameState, selection?: string[], selectedColor?: string) {
  let elements: TreeElement[] = [];
  if (root) {
    for (let i = root.elements.length; i--; i >= 0) {
      const item = root.elements[i];
      const element: TreeElement = {
        key: item.UID,
        title: item.getName(),
        selectable: true,
      };

      if (item instanceof FrameState) {
        element.children = getTreeData(item, selection, selectedColor);
      }
      elements.push(element);
    }
  }

  return elements;
}

export function onNodeDrop(
  info: { node: DropNode; dragNode: DragNode; dropPosition: number; dropToGap: boolean },
  treeData: TreeElement[]
) {
  const destKey = info.node.key;
  const srcKey = info.dragNode.key;
  const destPos = info.node.pos.split('-');
  const destPosition = info.dropPosition - Number(destPos[destPos.length - 1]);

  const loop = (data: TreeElement[], key: number, callback: TreeElementCallback) => {
    data.forEach((item, index, arr) => {
      if (item.key === key) {
        callback(item, index, arr);
        return;
      }
      if (item.children) {
        loop(item.children, key, callback);
      }
    });
  };
  const data = [...treeData];

  // Find dragObject
  let srcElement: TreeElement | undefined = undefined;
  loop(data, srcKey, (item: TreeElement, index: number, arr: TreeElement[]) => {
    arr.splice(index, 1);
    srcElement = item;
  });

  if (destPosition === 0) {
    // Drop on the content
    loop(data, destKey, (item: TreeElement) => {
      item.children = item.children || [];
      item.children.unshift(srcElement!);
    });
  } else {
    // Drop on the gap (insert before or insert after)
    let ar: TreeElement[] = [];
    let i = 0;
    loop(data, destKey, (item: TreeElement, index: number, arr: TreeElement[]) => {
      ar = arr;
      i = index;
    });

    if (destPosition === -1) {
      ar.splice(i, 0, srcElement!);
    } else {
      ar.splice(i + 1, 0, srcElement!);
    }
  }

  return data;
}
