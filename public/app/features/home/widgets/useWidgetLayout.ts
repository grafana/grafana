import { useCallback, useEffect, useRef, useState } from 'react';

import { useUserStorage } from '@grafana/runtime/internal';

import { packItems } from './layout';
import { SERVICE, LAYOUT_KEY } from './storage';
import {
  type HomeWidgetCatalogEntry,
  type WidgetLayout,
  type WidgetLayoutItem,
  WIDGET_LAYOUT_VERSION,
  parseWidgetLayout,
} from './types';

export interface UseWidgetLayoutResult {
  /** null = not-yet-loaded OR first-run; disambiguate with isLoading. */
  layout: WidgetLayout | null;
  isLoading: boolean;
  addWidget: (entry: HomeWidgetCatalogEntry) => void;
  removeWidget: (id: string) => void;
  setPositions: (items: WidgetLayoutItem[]) => void;
  applyPreset: (widgetIds: string[], catalog: HomeWidgetCatalogEntry[]) => void;
}

/**
 * Per-user homepage widget layout, persisted via core UserStorage (backend-backed with a
 * localStorage fallback). The mutators read the latest layout from a ref so they never close over
 * stale state, and stay referentially stable across renders.
 */
export function useWidgetLayout(): UseWidgetLayoutResult {
  const storage = useUserStorage(SERVICE);

  const [layout, setLayout] = useState<WidgetLayout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Mirror the latest layout so mutators read fresh items without re-subscribing on every change.
  const layoutRef = useRef<WidgetLayout | null>(null);

  const persist = useCallback(
    (next: WidgetLayout) => {
      layoutRef.current = next;
      setLayout(next);
      storage.setItem(LAYOUT_KEY, JSON.stringify(next));
    },
    [storage]
  );

  useEffect(() => {
    storage.getItem(LAYOUT_KEY).then((raw) => {
      const parsed = parseWidgetLayout(raw);
      layoutRef.current = parsed;
      setLayout(parsed);
      setIsLoading(false);
    });
  }, [storage]);

  const addWidget = useCallback(
    (entry: HomeWidgetCatalogEntry) => {
      const items = layoutRef.current?.items ?? [];
      // Idempotent: a widget already on the grid is never added twice.
      if (items.some((i) => i.id === entry.id)) {
        return;
      }
      // Drop the new widget below everything currently placed.
      const maxBottom = items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
      persist({
        version: WIDGET_LAYOUT_VERSION,
        items: [...items, { id: entry.id, x: 0, y: maxBottom, w: entry.defaultSize.w, h: entry.defaultSize.h }],
      });
    },
    [persist]
  );

  const removeWidget = useCallback(
    (id: string) => {
      const items = (layoutRef.current?.items ?? []).filter((i) => i.id !== id);
      persist({ version: WIDGET_LAYOUT_VERSION, items });
    },
    [persist]
  );

  // Wholesale replacement from the grid's drag/resize stop.
  const setPositions = useCallback(
    (items: WidgetLayoutItem[]) => {
      persist({ version: WIDGET_LAYOUT_VERSION, items });
    },
    [persist]
  );

  const applyPreset = useCallback(
    (widgetIds: string[], catalog: HomeWidgetCatalogEntry[]) => {
      persist({ version: WIDGET_LAYOUT_VERSION, items: packItems(widgetIds, catalog) });
    },
    [persist]
  );

  return { layout, isLoading, addWidget, removeWidget, setPositions, applyPreset };
}
