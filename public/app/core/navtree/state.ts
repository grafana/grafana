import { createAction, createReducer } from '@reduxjs/toolkit';

import { type NavModelItem } from '@grafana/data';

import { arePluginNavItemsEnabled } from './utils';

/**
 * Dispatched once the plugin nav has been merged into the client-built static
 * tree. The payload is the complete merged tree; both nav slices rebuild from
 * it, and the mega menu leaves its skeleton state.
 */
export const pluginNavLoaded = createAction<{ tree: NavModelItem[] }>('navTree/pluginNavLoaded');

export type PluginNavStatus = 'disabled' | 'loading' | 'loaded';

/**
 * Load state for the client-built nav tree. `disabled` (flag off) and `loaded`
 * render the tree as-is; `loading` keeps the mega menu on its skeleton until
 * the complete tree is available (static items are not guaranteed to sort
 * above plugin items once custom ordering lands). A failed metas fetch still
 * reaches `loaded`: the service falls back to the bootdata apps, so the tree
 * is as complete as it is going to get.
 */
export const pluginNavStatusReducer = createReducer<PluginNavStatus>(
  () => (arePluginNavItemsEnabled() ? 'loading' : 'disabled'),
  (builder) => {
    builder.addCase(pluginNavLoaded, () => 'loaded');
  }
);
