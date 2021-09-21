import { DashboardPickerItem } from 'app/core/components/editors/DashboardPickerByID';
import { useCallback, useState } from 'react';

import { PlaylistItem } from './types';

export function usePlaylistItems(playlistItems?: PlaylistItem[]) {
  const [items, setItems] = useState<PlaylistItem[]>(playlistItems ?? []);

  const addById = useCallback(
    (dashboard: DashboardPickerItem) => {
      if (!dashboard || items.find((item) => item.id === dashboard.id)) {
        return;
      }

      const newItem: PlaylistItem = {
        id: dashboard.id,
        title: dashboard.label,
        type: 'dashboard_by_id',
        value: dashboard.id.toString(10),
        order: items.length + 1,
      };
      setItems([...items, newItem]);
    },
    [items]
  );

  const addByTag = useCallback(
    (tags: string[]) => {
      const tag = tags[0];
      if (!tag || items.find((item) => item.value === tag)) {
        return;
      }

      const newItem: PlaylistItem = {
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

  const moveUp = useCallback(
    (item: PlaylistItem) => {
      movePlaylistItem(item, -1);
    },
    [movePlaylistItem]
  );

  const moveDown = useCallback(
    (item: PlaylistItem) => {
      movePlaylistItem(item, 1);
    },
    [movePlaylistItem]
  );

  const deleteItem = useCallback(
    (item: PlaylistItem) => {
      setItems(items.filter((i) => i !== item));
    },
    [items]
  );

  return { items, addById, addByTag, deleteItem, moveDown, moveUp };
}
