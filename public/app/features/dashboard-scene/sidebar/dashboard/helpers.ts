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
