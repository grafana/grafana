import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';

import {
  trackAlertsActivityBannerClickTry,
  trackAlertsActivityBannerDismiss,
  trackAlertsActivityBannerImpression,
} from '../Analytics';
import { ALERTING_PATHS } from '../utils/navigation';
import { createRelativeUrl } from '../utils/url';

import { useAlertsActivityBannerPrefs } from './hooks/useAlertsActivityBannerPrefs';

/**
 * Banner promoting Alerts Activity (triage view) to users on the Rule List page.
 *
 * Single responsibility: Promote Alerts Activity feature only.
 * The opt-out control is handled separately in RuleListPageTitle.
 *
 * Features:
 * - Dismissible for 30 days
 * - Telemetry tracking for impressions, clicks, dismissals
 */
export function AlertsActivityBanner() {
  const styles = useStyles2(getStyles);
  const { isDismissed, dismissBanner } = useAlertsActivityBannerPrefs();
  const impressionTracked = useRef(false);

  // Check if Alerts Activity feature is available
  const isAlertsActivityEnabled = config.featureToggles.alertingTriage ?? false;

  // Track impression once per mount
  useEffect(() => {
    if (!impressionTracked.current && !isDismissed && isAlertsActivityEnabled) {
      trackAlertsActivityBannerImpression();
      impressionTracked.current = true;
    }
  }, [isDismissed, isAlertsActivityEnabled]);

  // Don't render if:
  // - Alerts Activity is not enabled
  // - User has dismissed the banner (within 30 days)
  if (!isAlertsActivityEnabled || isDismissed) {
    return null;
  }

  const handleOpenAlertsActivity = () => {
    trackAlertsActivityBannerClickTry();
    // Navigation handled by LinkButton href
  };

  const handleDismiss = () => {
    const dismissedUntil = dismissBanner();
    trackAlertsActivityBannerDismiss(dismissedUntil);
  };

  return (
    <Alert
      severity="info"
      title={t('alerting.alerts-activity-banner.title', 'Alert Activity is now available!')}
      onRemove={handleDismiss}
      className={styles.banner}
    >
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="alerting.alerts-activity-banner.description">
            A brand new page is now available to handle operational work for your Grafana-managed alert rules. Find out
            what alerts are firing, explore historical information, filter and group to enhance your triage and root
            cause analysis.
          </Trans>
        </Text>

        <div>
          <LinkButton
            href={createRelativeUrl(ALERTING_PATHS.ALERTS_ACTIVITY)}
            variant="primary"
            size="sm"
            onClick={handleOpenAlertsActivity}
            aria-label={t('alerting.alerts-activity-banner.open-button-aria', 'Open Alerts Activity')}
          >
            <Trans i18nKey="alerting.alerts-activity-banner.open-button">See Alert Activity</Trans>
          </LinkButton>
        </div>
      </Stack>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    marginBottom: theme.spacing(2),
  }),
});
