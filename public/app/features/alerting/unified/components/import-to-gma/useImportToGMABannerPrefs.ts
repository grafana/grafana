import { useCallback, useState } from 'react';

import { store } from '@grafana/data';

export const IMPORT_TO_GMA_BANNER_DISMISSED_KEY = 'grafana.alerting.import_to_gma_banner.dismissed';

interface ImportToGMABannerPrefs {
  bannerIsDismissed: boolean;
  dismissBanner: () => void;
}

/**
 * Manages dismissal of the Import to GMA banner via localStorage so it stays hidden across
 * reloads once the user dismisses it.
 */
export function useImportToGMABannerPrefs(): ImportToGMABannerPrefs {
  const [bannerIsDismissed, setBannerIsDismissed] = useState(() =>
    store.getBool(IMPORT_TO_GMA_BANNER_DISMISSED_KEY, false)
  );

  const dismissBanner = useCallback(() => {
    store.set(IMPORT_TO_GMA_BANNER_DISMISSED_KEY, true);
    setBannerIsDismissed(true);
  }, []);

  return { bannerIsDismissed, dismissBanner };
}
