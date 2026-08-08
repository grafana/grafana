import { createAction, createReducer } from '@reduxjs/toolkit';

import { type NavModelItem } from '@grafana/data';

import { isClientNavTreeEnabled } from './buildStaticNavTree';

/**
 * Dispatched once the plugin nav has been merged into the client-built static
 * tree. The payload is the complete merged tree; both nav slices rebuild from
 * it, and the mega menu leaves its skeleton state.
 */
export const pluginNavLoaded = createAction<{ tree: NavModelItem[] }>('navTree/pluginNavLoaded');

/** Dispatched when the plugin metas fetch fails: the static-only tree stands. */
export const pluginNavFailed = createAction('navTree/pluginNavFailed');

export type PluginNavStatus = 'disabled' | 'loading' | 'loaded' | 'failed';

/**
 * Load state for the client-built nav tree. `disabled` (flag off) and `loaded`
 * render the tree as-is; `loading` keeps the mega menu on its skeleton until
 * the complete tree is available (static items are not guaranteed to sort
 * above plugin items once custom ordering lands); `failed` renders the
 * static-only tree with a warning.
 */
export const pluginNavStatusReducer = createReducer<PluginNavStatus>(
  () => (isClientNavTreeEnabled() ? 'loading' : 'disabled'),
  (builder) => {
    builder.addCase(pluginNavLoaded, () => 'loaded').addCase(pluginNavFailed, () => 'failed');
  }
);
