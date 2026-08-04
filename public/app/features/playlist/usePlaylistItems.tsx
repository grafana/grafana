import { useCallback, useState } from 'react';
import { useAsync } from 'react-use';

import { type DashboardPickerDTO } from 'app/core/components/Select/DashboardPicker';

import { type PlaylistItemUI } from './types';
import { loadDashboards } from './utils';

export function usePlaylistItems(playlistItems?: PlaylistItemUI[]) {
  const [items, setItems] = useState<PlaylistItemUI[]>(playlistItems ?? []);

  // Attach dashboards to any items still missing them. Merge onto the current state so an
  // in-flight load cannot clobber item settings edited while it was running.
  useAsync(async () => {
    if (items.every((item) => item.dashboards)) {
      return;
    }
    const loaded = await loadDashboards(items);
    setItems((current) => {
      // Bail if the list changed shape while loading; indices would no longer line up.
      if (current.length !== loaded.length) {
        return current;
      }
      return current.map((item, i) => (item.dashboards ? item : { ...item, dashboards: loaded[i].dashboards }));
    });
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
      // Empty means "no per-item interval" so playback falls back to the global interval.
      copy[index] = { ...copy[index], interval: interval || undefined };
      return copy;
    });
  }, []);

  const updateItemQueryParams = useCallback((index: number, queryParams: string) => {
    setItems((prev) => {
      if (!prev[index]) {
        return prev;
      }
      const copy = prev.slice();
      copy[index] = { ...copy[index], queryParams: queryParams || undefined };
      return copy;
    });
  }, []);

  return { items, addByUID, addByTag, deleteItem, moveItem, updateItemInterval, updateItemQueryParams };
}
