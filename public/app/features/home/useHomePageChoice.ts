import { useCallback, useEffect, useState } from 'react';

import { useUserStorage } from '@grafana/runtime/internal';

export const HOME_PAGE_STORAGE_SERVICE = 'grafana-homepage';
export const HOME_PAGE_STORAGE_KEY = 'pageId';

// The picker lives in the profile menu while the homepage may be open underneath it, so a save in
// one place has to reach every mounted reader.
const listeners = new Set<(pageId: string | null) => void>();

export interface HomePageChoice {
  /** The Grafana Page this user picked as home; `null` when they picked none, `undefined` while it loads. */
  pageId: string | null | undefined;
  /** Saves a page as this user's home, or clears the choice with `null`. */
  setPageId: (pageId: string | null) => Promise<void>;
}

export function useHomePageChoice(): HomePageChoice {
  const storage = useUserStorage(HOME_PAGE_STORAGE_SERVICE);
  const [pageId, setLoadedPageId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const onChange = (next: string | null) => {
      cancelled = true;
      setLoadedPageId(next);
    };
    listeners.add(onChange);
    storage
      .getItem(HOME_PAGE_STORAGE_KEY)
      // A failed read must not keep home on a loader forever; it falls through to the other home settings.
      .catch(() => null)
      .then((stored) => {
        if (!cancelled) {
          setLoadedPageId(stored || null);
        }
      });
    return () => {
      cancelled = true;
      listeners.delete(onChange);
    };
  }, [storage]);

  const setPageId = useCallback(
    async (next: string | null) => {
      if (next) {
        await storage.setItem(HOME_PAGE_STORAGE_KEY, next);
      } else {
        await storage.deleteItem(HOME_PAGE_STORAGE_KEY);
      }
      listeners.forEach((listener) => listener(next));
    },
    [storage]
  );

  return { pageId, setPageId };
}
