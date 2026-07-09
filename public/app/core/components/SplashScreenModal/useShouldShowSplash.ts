import { useCallback, useEffect, useState } from 'react';

import { useUserStorage } from '@grafana/runtime/internal';

const STORAGE_KEY = 'dismissedVersion';

export function useShouldShowSplash(version: string) {
  const [shouldShow, setShouldShow] = useState(false);
  const splashStorage = useUserStorage('grafana-splash-screen');

  useEffect(() => {
    splashStorage.getItem(STORAGE_KEY).then((dismissedVersion) => {
      if (dismissedVersion !== version) {
        setShouldShow(true);
      }
    });
  }, [version, splashStorage]);

  // Persist the dismissal but keep the modal open so the user can continue
  // navigating slides. Used when the user clicks a CTA that opens an external
  // page in a new tab - we treat that as "user has seen the splash" without
  // unmounting the current tab's modal.
  const markEngaged = useCallback(() => {
    splashStorage.setItem(STORAGE_KEY, version);
  }, [version, splashStorage]);

  const dismiss = useCallback(() => {
    splashStorage.setItem(STORAGE_KEY, version);
    setShouldShow(false);
  }, [version, splashStorage]);

  return { shouldShow, dismiss, markEngaged };
}
