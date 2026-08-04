import { useCallback, useState } from 'react';
import { useAsync } from 'react-use';

import { type DashboardPickerDTO } from 'app/core/components/Select/DashboardPicker';

import { type PlaylistItemUI } from './types';
import { loadDashboards } from './utils';

let nextPlaylistItemId = 0;

function createLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `playlist-item-${Date.now()}-${nextPlaylistItemId++}`;
}

function withLocalId(item: PlaylistItemUI): PlaylistItemUI {
  return item.localId ? item : { ...item, localId: createLocalId() };
}

export function usePlaylistItems(playlistItems?: PlaylistItemUI[]) {
  const [items, setItems] = useState<PlaylistItemUI[]>(() => (playlistItems ?? []).map(withLocalId));

  // Attach dashboards to any items still missing them. Merge onto the current state so an
  // in-flight load cannot clobber item settings edited while it was running.
  useAsync(async () => {
    if (items.every((item) => item.dashboards)) {
      return;
    }
    const loaded = await loadDashboards(items);
    const loadedById = new Map(loaded.map((item) => [item.localId, item]));
    setItems((current) => {
      return current.map((item) => {
        const loadedItem = loadedById.get(item.localId);
        return item.dashboards || !loadedItem ? item : { ...item, dashboards: loadedItem.dashboards };
      });
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
          localId: createLocalId(),
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
        localId: createLocalId(),
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
