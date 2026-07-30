import { useEffect } from 'react';
import { useStore } from 'react-redux';

import { type NavModelItem } from '@grafana/data';
import { getAppPluginMetasStrict } from '@grafana/runtime/internal';
import { useDispatch, useSelector, type StoreState } from 'app/types/store';

import { mergePluginNavIntoTree } from './buildPluginNav';
import { isClientNavTreeEnabled } from './buildStaticNavTree';
import { pluginNavFailed, pluginNavLoaded } from './state';

export interface UseNavTreeResult {
  /** The nav tree: static items plus, once loaded, the merged plugin nav items */
  data: NavModelItem[];
  /** True while the client-built tree is incomplete (plugin metas still loading) */
  isLoading: boolean;
  /** True when the plugin metas fetch failed and only the static tree is shown */
  isError: boolean;
}

// Shared across hook consumers so a metas response is merged and dispatched
// exactly once, no matter how many components use the hook. Works because the
// pluginMeta service caches the fetch promise, so every consumer resolves to
// the same array instance.
const mergedResponses = new WeakSet<object>();

/**
 * The data-loading source for the navigation tree. With
 * `grafana.multiTenantNavTree` enabled it drives the client-side build:
 * fetches app-plugin metas via the grafana-runtime pluginMeta service, merges
 * their nav items into the static tree, and reports load state so the menu can
 * hold its skeleton until the tree is complete. With the flag off it simply
 * returns the server-provided tree with `isLoading: false`. Presentation
 * concerns (pinning, hiding, ordering) layer on top in useNavCustomization,
 * which is what the MegaMenu consumes.
 */
export function useNavTree(): UseNavTreeResult {
  const enabled = isClientNavTreeEnabled();
  const dispatch = useDispatch();
  const store = useStore<StoreState>();
  const navTree = useSelector((state) => state.navBarTree);
  const status = useSelector((state) => state.pluginNavStatus);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    // A failed fetch invalidates the service's cache entry, so the next mount
    // retries; a successful response is cached for the rest of the session.
    getAppPluginMetasStrict().then(
      (apps) => {
        // NOTE: an empty-but-successful metas response is indistinguishable
        // from an instance with no app plugins, so a UI loaded seconds after a
        // server restart (before installsync has written the Plugin objects)
        // will miss plugin nav items until a full reload. Accepted for now.
        if (cancelled || mergedResponses.has(apps)) {
          return;
        }
        mergedResponses.add(apps);
        const merged = mergePluginNavIntoTree(store.getState().navBarTree, apps);
        dispatch(pluginNavLoaded({ tree: merged }));
      },
      () => {
        if (!cancelled) {
          dispatch(pluginNavFailed());
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, dispatch, store]);

  return {
    data: navTree,
    isLoading: status === 'loading',
    isError: status === 'failed',
  };
}
