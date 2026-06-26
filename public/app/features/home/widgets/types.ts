import { type ReactNode } from 'react';
import { z } from 'zod';

import { type IconName } from '@grafana/data';

/** Where a catalog entry originates: core built-in, core-authored curated (plugin-gated), or open plugin extension. */
type WidgetSource = 'core' | 'curated' | 'plugin' | 'panel';

/** A widget that can be placed on the grid. Already-translated, fully resolved (availability decided upstream). */
export interface HomeWidgetCatalogEntry {
  /** Stable id persisted in the layout. */
  id: string;
  title: string;
  description: string;
  icon: IconName;
  source: WidgetSource;
  /** Initial grid footprint in 24-col grid units. */
  defaultSize: { w: number; h: number };
  /** Smallest footprint the user can resize to. */
  minSize: { w: number; h: number };
  /** Renders a fully-styled card (the entry owns its own HomeSection wrapper). */
  render: () => ReactNode;
}

export const WIDGET_LAYOUT_VERSION = 1;

/** Reference to a dashboard panel pinned as a homepage widget. Re-fetched live on render. */
const PanelRefSchema = z.object({
  dashboardUid: z.string(),
  panelId: z.number().int(),
  title: z.string().optional(),
});

const WidgetLayoutItemSchema = z.object({
  id: z.string(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  // Present only for pinned-panel widgets; ordinary widgets omit it (backward compatible).
  panel: PanelRefSchema.optional(),
});

const WidgetLayoutSchema = z.object({
  version: z.literal(WIDGET_LAYOUT_VERSION),
  items: z.array(WidgetLayoutItemSchema),
});

export type WidgetLayoutItem = z.infer<typeof WidgetLayoutItemSchema>;
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>;
export type PanelRef = z.infer<typeof PanelRefSchema>;

/** Stable layout id for a pinned panel, and the dedup key. The id alone encodes the panel reference. */
export function panelWidgetId(dashboardUid: string, panelId: number): string {
  return `panel:${dashboardUid}:${panelId}`;
}

// dashboardUid is `[a-zA-Z0-9_-]+` (never contains `:`), so a well-formed id is exactly three
// `:`-segments with a canonical non-negative integer panelId — the precise inverse of panelWidgetId.
const PANEL_WIDGET_ID_RE = /^panel:([^:]+):(0|[1-9]\d*)$/;

/** Inverse of {@link panelWidgetId}. Returns null for any non-panel or malformed id. */
export function parsePanelWidgetId(id: string): PanelRef | null {
  const match = PANEL_WIDGET_ID_RE.exec(id);
  if (!match) {
    return null;
  }
  const panelId = Number(match[2]);
  if (!Number.isSafeInteger(panelId)) {
    return null;
  }
  return { dashboardUid: match[1], panelId };
}

/**
 * The old drag/resize bug stripped `panel` from pinned items; the id is the only surviving source of
 * the ref, so rebuild it. A stripped panel item with an unparseable id is irrecoverable — it can
 * neither render nor be repaired — so it is intentionally dropped here (this is narrower than, and
 * distinct from, WidgetGrid's policy of keeping unknown non-panel ids in storage). Every other item,
 * including unknown non-panel ids, passes through untouched.
 */
function healPanelItems(items: WidgetLayoutItem[]): WidgetLayoutItem[] {
  return items.flatMap((item) => {
    if (item.panel || !item.id.startsWith('panel:')) {
      return [item];
    }
    const panel = parsePanelWidgetId(item.id);
    return panel ? [{ ...item, panel }] : [];
  });
}

/**
 * Drop any item whose id repeats an earlier one's. An id uniquely identifies a single widget and is
 * its grid/React key, so a duplicate is corruption (a hand-edited layout, or one mangled by the old
 * bug) — keep the first, preserving its grid position, and stop duplicate keys from reaching the grid.
 */
function dedupeById(items: WidgetLayoutItem[]): WidgetLayoutItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

/**
 * Parse a raw UserStorage string into a layout. Returns null on missing/invalid input
 * (treated as first-run, which triggers the persona chooser). Unknown widget ids inside an
 * otherwise-valid layout are tolerated and filtered at render time, not rejected here. Items that
 * repeat an earlier item's id are collapsed to the first (see {@link dedupeById}).
 */
export function parseWidgetLayout(raw: string | null): WidgetLayout | null {
  if (!raw) {
    return null;
  }
  try {
    const result = WidgetLayoutSchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      return null;
    }
    return { ...result.data, items: dedupeById(healPanelItems(result.data.items)) };
  } catch {
    return null;
  }
}

/**
 * Core built-in widget definition. Curated (plugin-gated) and open plugin entries are produced by hooks
 * and surface directly as HomeWidgetCatalogEntry; only built-ins use this static shape.
 */
export interface CoreWidgetDef {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  /** Synchronous availability gate (permission / config). */
  isAvailable: () => boolean;
  /** Renders its own HomeSection card. */
  render: () => ReactNode;
}
