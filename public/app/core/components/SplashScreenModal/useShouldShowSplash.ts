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

  const dismiss = useCallback(() => {
    splashStorage.setItem(STORAGE_KEY, version);
    setShouldShow(false);
  }, [version, splashStorage]);

  return { shouldShow, dismiss };
}
