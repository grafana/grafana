import { type SceneObject } from '@grafana/scenes';

import { getDashboardSceneFor } from '../../utils/utils';

export function selectSidebarObject(obj: SceneObject) {
  const { sidebar } = getDashboardSceneFor(obj).state;
  sidebar.selectObject(obj);
}

export interface DraggableListItemActions<T> {
  onEditItem: (item: T) => void;
  onDuplicateItem: (item: T) => void;
  onDeleteItem: (item: T) => void;
}

export function toDraggableListItemActions<T>(
  onEdit: (item: T) => void,
  onDuplicate: (item: T) => void,
  onDelete: (item: T) => void
): DraggableListItemActions<T> {
  return { onEditItem: onEdit, onDuplicateItem: onDuplicate, onDeleteItem: onDelete };
}

// groups objects into named buckets
// items whose getPartitionKey callback returns null are excluded
export function partitionSceneObjects<T extends SceneObject>(
  objects: T[],
  getPartitionKey: (v: T) => string | null
): Partial<Record<string, T[]>> {
  const result: Partial<Record<string, T[]>> = {};

  for (const o of objects) {
    const key = getPartitionKey(o);
    if (key !== null) {
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(o);
    }
  }

  return result;
}
