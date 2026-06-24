import { type Layout } from 'react-grid-layout';

import { GRID_COLUMN_COUNT } from 'app/core/constants';

import { type HomeWidgetCatalogEntry, type WidgetLayoutItem } from './types';

/**
 * Deterministically pack the given widget ids into grid positions, left-to-right then top-to-bottom
 * over a {@link GRID_COLUMN_COUNT}-column grid. Ids missing from the catalog (unavailable widgets) are
 * skipped. Each entry's width is clamped to the grid width so an oversized default never overflows.
 * Used to seed a layout from a preset and as the default placement when first populating the grid.
 */
export function packItems(ids: string[], catalog: HomeWidgetCatalogEntry[]): WidgetLayoutItem[] {
  const items: WidgetLayoutItem[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;

  for (const id of ids) {
    const entry = catalog.find((e) => e.id === id);
    if (!entry) {
      continue;
    }

    const w = Math.min(entry.defaultSize.w, GRID_COLUMN_COUNT);
    const h = entry.defaultSize.h;

    // Wrap to a new row when the widget would overflow the current one.
    if (cursorX + w > GRID_COLUMN_COUNT) {
      cursorY += rowMaxH;
      cursorX = 0;
      rowMaxH = 0;
    }

    items.push({ id, x: cursorX, y: cursorY, w, h });

    cursorX += w;
    rowMaxH = Math.max(rowMaxH, h);
  }

  return items;
}

/**
 * Merge react-grid-layout's new positions onto the existing items, preserving every non-position
 * field (notably a pinned panel's `panel` reference). Items absent from the RGL layout — excluded
 * from the grid because their id has no catalog entry (uninstalled plugin / lost permission) — are
 * returned untouched so they survive in storage.
 */
export function mergeItemPositions(items: WidgetLayoutItem[], rglLayout: Layout[]): WidgetLayoutItem[] {
  const byId = new Map(rglLayout.map((l) => [l.i, l] as const));
  return items.map((item) => {
    const l = byId.get(item.id);
    return l ? { ...item, x: l.x, y: l.y, w: l.w, h: l.h } : item;
  });
}
