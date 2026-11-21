import { useCallback, useState } from 'react';
import { useAsync } from 'react-use';

import { type DashboardPickerDTO } from 'app/core/components/Select/DashboardPicker';

import { type PlaylistItemUI } from './types';
import { loadDashboards } from './utils';

const itemKey = (item: PlaylistItemUI) => `${item.type}/${item.value}`;

export function usePlaylistItems(playlistItems?: PlaylistItemUI[]) {
  const [items, setItems] = useState<PlaylistItemUI[]>(playlistItems ?? []);

  // Merge loaded dashboards onto the current state so an in-flight load can't clobber edits made meanwhile.
  useAsync(async () => {
    if (items.every((item) => item.dashboards)) {
      return;
    }
    const loaded = await loadDashboards(items);
    const dashboardsByItem = new Map(loaded.map((item) => [itemKey(item), item.dashboards]));
    setItems((current) =>
      // Match by identity, not index: rows may have been reordered or removed while loading.
      current.map((item) => {
        const dashboards = item.dashboards ? undefined : dashboardsByItem.get(itemKey(item));
        return dashboards ? { ...item, dashboards } : item;
      })
    );
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

  const updateItemInterval = useCallback((index: number, interval: string) => {
    setItems((prev) => {
      if (!prev[index]) {
        return prev;
      }
      const copy = prev.slice();
      // Blank means no override; playback uses the global interval.
      copy[index] = { ...copy[index], interval: interval || undefined };
      return copy;
    });
  }, []);

  return { items, addByUID, addByTag, deleteItem, moveItem, updateItemInterval };
}
