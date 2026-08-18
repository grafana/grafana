import { useCallback } from 'react';

export interface DraggableListItemActions<T> {
  onEditItem: (item: T) => void;
  onDuplicateItem: (item: T) => void;
  onDeleteItem: (item: T) => void;
}

export function useDraggableListItemActions<T>(
  onEdit: (item: T) => void,
  onDuplicate: (item: T) => void,
  onDelete: (item: T) => void
): DraggableListItemActions<T> {
  const onEditItem = useCallback((item: T) => onEdit(item), [onEdit]);
  const onDuplicateItem = useCallback((item: T) => onDuplicate(item), [onDuplicate]);
  const onDeleteItem = useCallback((item: T) => onDelete(item), [onDelete]);

  return { onEditItem, onDuplicateItem, onDeleteItem };
}
