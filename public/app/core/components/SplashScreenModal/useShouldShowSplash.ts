import { useCallback, useEffect, useState } from 'react';

import { useUserStorage } from '@grafana/runtime/internal';

const STORAGE_KEY = 'dismissedVersion';
const SESSION_KEY_PREFIX = 'grafana-splash-active-';

// Per-tab flag that survives reloads but not tab close. Lets the modal stay
// available after the user clicks a CTA (which persists the dismissal in
// userStorage) so they can still browse the remaining slides in this tab,
// while new tabs / future sessions correctly skip the splash.
const sessionKey = (version: string) => `${SESSION_KEY_PREFIX}${version}`;

const readSessionFlag = (version: string): boolean => {
  try {
    return window.sessionStorage.getItem(sessionKey(version)) !== null;
  } catch {
    return false;
  }
};

const writeSessionFlag = (version: string) => {
  try {
    window.sessionStorage.setItem(sessionKey(version), '1');
  } catch {
    // sessionStorage may be unavailable (e.g. locked-down browser settings);
    // splash will still work, it just won't survive a reload after engaging.
  }
};

const clearSessionFlag = (version: string) => {
  try {
    window.sessionStorage.removeItem(sessionKey(version));
  } catch {
    // ignore
  }
};

export function useShouldShowSplash(version: string) {
  const [shouldShow, setShouldShow] = useState(false);
  const splashStorage = useUserStorage('grafana-splash-screen');

  useEffect(() => {
    if (readSessionFlag(version)) {
      setShouldShow(true);
      return;
    }
    splashStorage.getItem(STORAGE_KEY).then((dismissedVersion) => {
      if (dismissedVersion !== version) {
        writeSessionFlag(version);
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
    clearSessionFlag(version);
    setShouldShow(false);
  }, [version, splashStorage]);

  return { shouldShow, dismiss, markEngaged };
}
