import { useEffect, useState } from 'react';

import { store } from 'app/store/store';

/**
 * Re-renders the caller once the plugin nav merge lands.
 *
 * App plugin routes are derived from navIndex, which getAppPluginRoutes reads
 * imperatively, so it only yields plugin routes after the async metas merge.
 * The router therefore has to recompute once at that point.
 *
 * Subscribes to the store directly because the only caller sits above the
 * redux Provider, where useSelector is unavailable. Unsubscribes as soon as
 * the merge lands: the tree is built once per session.
 */
export function usePluginNavRerender(): void {
  const [, setMerged] = useState(false);

  useEffect(() => {
    if (store.getState().pluginNavStatus !== 'loading') {
      return;
    }
    const unsubscribe = store.subscribe(() => {
      if (store.getState().pluginNavStatus === 'loaded') {
        setMerged(true);
        unsubscribe();
      }
    });
    return unsubscribe;
  }, []);
}
