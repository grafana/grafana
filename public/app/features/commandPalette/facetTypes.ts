import { ReactNode } from 'react';

/**
 * Local type definitions for command palette faceted search.
 *
 * These mirror the types in @grafana/data/src/types/pluginExtensions.ts but are
 * defined locally because the fork-ts-checker-webpack-plugin with write-references
 * mode resolves types from a stale tsbuildinfo cache that doesn't include them yet.
 */

export interface CommandPaletteFacetContext {
  searchQuery: string;
  activeFacets: Record<string, string>;
  signal: AbortSignal;
}

export interface CommandPaletteFacetValue {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export interface CommandPaletteDynamicFacet {
  id: string;
  label: string;
  shortcutKey?: string;
  placeholder?: string;
  getValues: (context: CommandPaletteFacetContext) => Promise<CommandPaletteFacetValue[]>;
}
