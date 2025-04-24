import { useCallback, useState } from 'react';
import { useAsync } from 'react-use';

import { DashboardPickerDTO } from 'app/core/components/Select/DashboardPicker';

import { PlaylistItemUI } from './types';
import { loadDashboards } from './utils';

export function usePlaylistItems(playlistItems?: PlaylistItemUI[]) {
  const [items, setItems] = useState<PlaylistItemUI[]>(playlistItems ?? []);

  // Attach dashboards if any were missing
  useAsync(async () => {
    for (const item of items) {
      if (!item.dashboards) {
        setItems(await loadDashboards(items));
        return;
      }
    }
  }, [items]);

  const addByUID = useCallback(
    (dashboard?: DashboardPickerDTO) => {
      if (!dashboard) {
        return;
      }

      setItems([
        ...items,
        {
          type: 'dashboard_by_uid',
          value: dashboard.uid,
        },
      ]);
    },
    [items]
  );

  const addByTag = useCallback(
    (tags: string[]) => {
      const tag = tags[0];
      if (!tag || items.find((item) => item.value === tag)) {
        return;
      }

      const newItem: PlaylistItemUI = {
        type: 'dashboard_by_tag',
        value: tag,
      };
      setItems([...items, newItem]);
    },
    [items]
  );

  const moveItem = useCallback(
    (src: number, dst: number) => {
      if (src === dst || !items[src]) {
        return; // nothing to do
      }
      const update = Array.from(items);
      const [removed] = update.splice(src, 1);
      update.splice(dst, 0, removed);
      setItems(update);
    },
    [items]
  );

  const deleteItem = useCallback(
    (index: number) => {
      const copy = items.slice();
      copy.splice(index, 1);
      setItems(copy);
    },
    [items]
  );

  return { items, addByUID, addByTag, deleteItem, moveItem };
}
