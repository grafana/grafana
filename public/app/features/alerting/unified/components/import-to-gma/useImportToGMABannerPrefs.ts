import { useCallback, useState } from 'react';

import { store } from '@grafana/data';
import { config } from '@grafana/runtime';

// Module-private base key
const IMPORT_TO_GMA_BANNER_DISMISSED_KEY = 'grafana.alerting.import_to_gma_banner.dismissed';

// Scope dismissal per org so hiding the banner in one org does not hide it in another
export function getImportToGMABannerDismissedKey(orgId: number): string {
  return `${IMPORT_TO_GMA_BANNER_DISMISSED_KEY}-org-${orgId}`;
}

interface ImportToGMABannerPrefs {
  bannerIsDismissed: boolean;
  dismissBanner: () => void;
}

/**
 * Manages dismissal of the Import to GMA banner via localStorage so it stays hidden across
 * reloads once the user dismisses it. Scoped per org.
 */
export function useImportToGMABannerPrefs(): ImportToGMABannerPrefs {
  const key = getImportToGMABannerDismissedKey(config.bootData.user.orgId);
  const [bannerIsDismissed, setBannerIsDismissed] = useState(() => store.getBool(key, false));

  const dismissBanner = useCallback(() => {
    store.set(key, true);
    setBannerIsDismissed(true);
  }, [key]);

  return { bannerIsDismissed, dismissBanner };
}
