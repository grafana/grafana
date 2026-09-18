import { useEffect } from 'react';
import { useStore } from 'react-redux';

import { type NavModelItem } from '@grafana/data';
import { getAppPluginMetas } from '@grafana/runtime/internal';
import { useDispatch, useSelector, type StoreState } from 'app/types/store';

import { carryOverRuntimeChildren, mergePluginNavIntoTree } from './buildPluginNav';
import { arePluginNavItemsEnabled } from './buildStaticNavTree';
import { useAppAccessScopes } from './pluginAccess';
import { pluginNavLoaded } from './state';

export interface UseNavTreeResult {
  /** The nav tree: static items plus, once loaded, the merged plugin nav items */
  data: NavModelItem[];
  /** True while the client-built tree is incomplete (plugin metas still loading) */
  isLoading: boolean;
}

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
  const enabled = arePluginNavItemsEnabled();
  const dispatch = useDispatch();
  const store = useStore<StoreState>();
  const navTree = useSelector((state) => state.navBarTree);
  const status = useSelector((state) => state.pluginNavStatus);
  const { scopes: appAccessScopes, isLoading: scopesLoading } = useAppAccessScopes();

  useEffect(() => {
    // Merging once per session is enough: the metas fetch is session-cached,
    // so a remount would just re-merge the same response. A failed fetch falls
    // back to the bootdata apps and is reported by the pluginMeta service.
    //
    // Wait for the access scopes first: merging without them would gate every
    // app on the unscoped permission and, because we only merge once, never
    // revisit that once they arrive.
    if (!enabled || scopesLoading || store.getState().pluginNavStatus === 'loaded') {
      return;
    }
    let cancelled = false;
    getAppPluginMetas().then((apps) => {
      if (cancelled || store.getState().pluginNavStatus === 'loaded') {
        return;
      }
      const merged = carryOverRuntimeChildren(
        mergePluginNavIntoTree(apps, appAccessScopes),
        store.getState().navBarTree
      );
      dispatch(pluginNavLoaded({ tree: merged }));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, scopesLoading, appAccessScopes, dispatch, store]);

  return {
    data: navTree,
    isLoading: status === 'loading',
  };
}
