import { useEffect } from 'react';
import { useStore } from 'react-redux';

import { type NavModelItem } from '@grafana/data';
import { getAppPluginMetas } from '@grafana/runtime/internal';
import { useDispatch, useSelector, type StoreState } from 'app/types/store';

import { carryOverRuntimeChildren, mergePluginNavIntoTree } from './buildPluginNav';
import { buildStaticNavTree } from './buildStaticNavTree';
import { pluginNavLoaded } from './state';
import { applyAppSubUrl, arePluginNavItemsEnabled } from './utils';

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

  useEffect(() => {
    // Merging once per session is enough: the metas fetch is session-cached,
    // so a remount would just re-merge the same response. A failed fetch falls
    // back to the bootdata apps and is reported by the pluginMeta service.
    if (!enabled || store.getState().pluginNavStatus === 'loaded') {
      return;
    }
    let cancelled = false;
    getAppPluginMetas().then((apps) => {
      if (cancelled || store.getState().pluginNavStatus === 'loaded') {
        return;
      }
      // The sub-url prefix goes on before the runtime children are carried
      // over, because those come from the store already prefixed
      const withPlugins = applyAppSubUrl(mergePluginNavIntoTree(apps, buildStaticNavTree()));
      const merged = carryOverRuntimeChildren(withPlugins, store.getState().navBarTree);
      dispatch(pluginNavLoaded({ tree: merged }));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, dispatch, store]);

  return {
    data: navTree,
    isLoading: status === 'loading',
  };
}
