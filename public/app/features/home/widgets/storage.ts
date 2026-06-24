import { UserStorage } from '@grafana/runtime/internal';

import { type PanelRef, WIDGET_LAYOUT_VERSION, panelWidgetId, parseWidgetLayout } from './types';

export const SERVICE = 'grafana-homepage';
export const LAYOUT_KEY = 'widget-layout';

/**
 * Append a panel to the per-user homepage layout, below everything already placed.
 * Idempotent: pinning the same panel twice is a no-op. Tolerates a missing/invalid
 * stored layout by starting a fresh one. Safe to call from anywhere (no React context).
 */
export async function pinPanelToHomepage(ref: PanelRef): Promise<void> {
  const storage = new UserStorage(SERVICE);
  const layout = parseWidgetLayout(await storage.getItem(LAYOUT_KEY)) ?? { version: WIDGET_LAYOUT_VERSION, items: [] };
  const id = panelWidgetId(ref.dashboardUid, ref.panelId);
  if (layout.items.some((item) => item.id === id)) {
    return;
  }
  const maxBottom = layout.items.reduce((m, item) => Math.max(m, item.y + item.h), 0);
  const next = {
    version: WIDGET_LAYOUT_VERSION,
    items: [...layout.items, { id, x: 0, y: maxBottom, w: 12, h: 9, panel: ref }],
  };
  await storage.setItem(LAYOUT_KEY, JSON.stringify(next));
}
