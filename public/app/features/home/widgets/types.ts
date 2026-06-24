import { type ComponentType, type ReactNode } from 'react';
import { z } from 'zod';

import { type IconName } from '@grafana/data';

/** Where a catalog entry originates: core built-in, core-authored curated (plugin-gated), or open plugin extension. */
export type WidgetSource = 'core' | 'curated' | 'plugin';

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

const WidgetLayoutItemSchema = z.object({
  id: z.string(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

const WidgetLayoutSchema = z.object({
  version: z.literal(WIDGET_LAYOUT_VERSION),
  items: z.array(WidgetLayoutItemSchema),
});

export type WidgetLayoutItem = z.infer<typeof WidgetLayoutItemSchema>;
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>;

/**
 * Parse a raw UserStorage string into a layout. Returns null on missing/invalid input
 * (treated as first-run, which triggers the persona chooser). Unknown widget ids inside an
 * otherwise-valid layout are tolerated and filtered at render time, not rejected here.
 */
export function parseWidgetLayout(raw: string | null): WidgetLayout | null {
  if (!raw) {
    return null;
  }
  try {
    const result = WidgetLayoutSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
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
  /** Zero-prop component that renders its own HomeSection card. */
  Component: ComponentType;
}
