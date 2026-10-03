import { useEffect, useState } from 'react';

import { store } from 'app/store/store';

/**
 * Plugin pages have no routes until the app metas have merged, because the
 * router builds them from navIndex. Re-renders the caller once that happens so
 * it recomputes them.
 *
 * Reads the store directly rather than with useSelector: its only caller sits
 * above the redux Provider. The merge happens once per session, so it
 * unsubscribes straight after.
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
