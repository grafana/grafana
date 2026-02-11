import { useCallback, useMemo } from 'react';
import { useLocalStorage } from 'react-use';

const STORAGE_KEY_DISMISSED_UNTIL = 'grafana.alerting.alerts_activity_banner.dismissed_until';

// Default dismissal duration: 30 days
const DISMISSAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface AlertsActivityBannerPrefs {
  /** Whether the banner is currently dismissed (within dismissal period) */
  isDismissed: boolean;
  /** Dismiss the banner for the default duration (30 days). Returns the dismissal expiry date. */
  dismissBanner: () => string;
}

/**
 * Hook to manage Alerts Activity banner dismissal preferences using localStorage.
 *
 * Note: The view experience toggle (new/old view) is handled separately by the
 * preview toggle mechanism in RuleListPageTitle, not by this banner.
 *
 * TODO: Migrate to server-side API when /api/alerting/ui-preferences is available
 */
export function useAlertsActivityBannerPrefs(): AlertsActivityBannerPrefs {
  const [dismissedUntilRaw, setDismissedUntil] = useLocalStorage<string | null>(STORAGE_KEY_DISMISSED_UNTIL, null);

  const isDismissed = useMemo(() => {
    if (!dismissedUntilRaw) {
      return false;
    }
    try {
      const dismissedUntilDate = new Date(dismissedUntilRaw);
      return dismissedUntilDate > new Date();
    } catch {
      return false;
    }
  }, [dismissedUntilRaw]);

  const dismissBanner = useCallback(() => {
    const dismissedUntil = new Date(Date.now() + DISMISSAL_DURATION_MS).toISOString();
    setDismissedUntil(dismissedUntil);
    return dismissedUntil;
  }, [setDismissedUntil]);

  return {
    isDismissed,
    dismissBanner,
  };
}
