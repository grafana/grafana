import { useCallback, useEffect, useState } from 'react';

import { UserStorage } from '@grafana/runtime/internal';

const STORAGE_KEY = 'dismissedVersion';
const splashStorage = new UserStorage('splash-screen');

export function useShouldShowSplash(version: string) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    splashStorage.getItem(STORAGE_KEY).then((dismissedVersion) => {
      if (dismissedVersion !== version) {
        setShouldShow(true);
      }
    });
  }, [version]);

  const dismiss = useCallback(() => {
    splashStorage.setItem(STORAGE_KEY, version);
    setShouldShow(false);
  }, [version]);

  return { shouldShow, dismiss };
}
