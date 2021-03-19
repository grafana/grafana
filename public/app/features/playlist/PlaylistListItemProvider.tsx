import React, { FC, useCallback, useState } from 'react';
import { PlaylistItem } from './playlist_edit_ctrl';
import { DashboardPickerItem } from '../../core/components/Select/DashboardPicker';

interface PlaylistListItemProviderApi {
  items: PlaylistItem[];
  addById: (dashboard: DashboardPickerItem) => void;
  addByTag: (tags: string[]) => void;
  moveUp: (item: PlaylistItem) => void;
  moveDown: (item: PlaylistItem) => void;
  remove: (item: PlaylistItem) => void;
}

interface PlaylistListItemProviderProps {
  items?: PlaylistItem[];
  children: (props: PlaylistListItemProviderApi) => JSX.Element;
}

export const PlaylistListItemProvider: FC<PlaylistListItemProviderProps> = ({ items: propsItems, children }) => {
  const [items, setItems] = useState<PlaylistItem[]>(propsItems ?? []);
  const onAddById = useCallback(
    (dashboard: DashboardPickerItem) => {
      if (items.find((item) => item.id === dashboard.id)) {
        return;
      }

      const newItem: PlaylistItem = {
        id: dashboard.id,
        title: dashboard.label,
        type: 'dashboard_by_id',
        value: dashboard.value,
        order: items.length + 1,
      };
      setItems([...items, newItem]);
    },
    [items]
  );
  const onAddByTag = useCallback(
    (tags: string[]) => {
      const tag = tags[0];
      if (!tag || items.find((item) => item.id === tag)) {
        return;
      }

      const newItem: PlaylistItem = {
        id: tag,
        title: tag,
        type: 'dashboard_by_tag',
        value: tag,
        order: items.length + 1,
      };
      setItems([...items, newItem]);
    },
    [items]
  );
  const movePlaylistItem = useCallback(
    (item: PlaylistItem, offset: number) => {
      const newItems = [...items];
      const currentPosition = newItems.indexOf(item);
      const newPosition = currentPosition + offset;

      if (newPosition >= 0 && newPosition < newItems.length) {
        newItems.splice(currentPosition, 1);
        newItems.splice(newPosition, 0, item);
      }
      setItems(newItems);
    },
    [items]
  );
  const onMoveUp = useCallback(
    (item: PlaylistItem) => {
      movePlaylistItem(item, -1);
    },
    [items]
  );
  const onMoveDown = useCallback(
    (item: PlaylistItem) => {
      movePlaylistItem(item, 1);
    },
    [items]
  );
  const onDelete = useCallback(
    (item: PlaylistItem) => {
      setItems(items.filter((i) => i.id !== item.id));
    },
    [items]
  );

  return (
    <>
      {children({
        items,
        addById: onAddById,
        addByTag: onAddByTag,
        moveUp: onMoveUp,
        moveDown: onMoveDown,
        remove: onDelete,
      })}
    </>
  );
};
