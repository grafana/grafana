import { css } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';

import { GrafanaTheme2, createRelativeUrl } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import {
  getStackType,
  getUserPlan,
  trackAlertsActivityBannerClickTry,
  trackAlertsActivityBannerDismiss,
  trackAlertsActivityBannerImpression,
} from '../Analytics';
import { ALERTING_PATHS } from '../utils/navigation';

import { useAlertsActivityBannerPrefs } from './hooks/useAlertsActivityBannerPrefs';

const BANNER_ID = 'alerts-activity-v1';

export interface AlertsActivityBannerProps {
  /** Unique identifier for this banner instance (for A/B testing) */
  variantId?: string | null;
}

/**
 * Banner promoting Alerts Activity (triage view) to users on the Rule List page.
 *
 * Single responsibility: Promote Alerts Activity feature only.
 * The opt-out control is handled separately in RuleListPageTitle.
 *
 * Features:
 * - Dismissible for 30 days
 * - DMA stack detection with limited functionality note
 * - Full telemetry tracking for impressions, clicks, dismissals
 */
export function AlertsActivityBanner({ variantId = null }: AlertsActivityBannerProps) {
  const styles = useStyles2(getStyles);
  const { isDismissed, dismissBanner } = useAlertsActivityBannerPrefs();
  const impressionTracked = useRef(false);

  // Determine stack type for telemetry and UI
  const stackType = getStackType();
  const isDMAStack = stackType === 'DMA';
  const plan = getUserPlan();

  // Check if Alerts Activity feature is available
  const isAlertsActivityEnabled = config.featureToggles.alertingTriage ?? false;

  const getEventPayload = useCallback(
    () => ({
      banner_id: BANNER_ID,
      page: 'rule_list',
      user_id: contextSrv.user.id,
      org_id: contextSrv.user.orgId,
      stack_type: stackType,
      plan,
      variant_id: variantId,
    }),
    [stackType, plan, variantId]
  );

  // Track impression once per mount
  useEffect(() => {
    if (!impressionTracked.current && !isDismissed && isAlertsActivityEnabled) {
      trackAlertsActivityBannerImpression(getEventPayload());
      impressionTracked.current = true;
    }
  }, [isDismissed, isAlertsActivityEnabled, getEventPayload]);

  // Don't render if:
  // - Alerts Activity is not enabled
  // - User has dismissed the banner (within 30 days)
  if (!isAlertsActivityEnabled || isDismissed) {
    return null;
  }

  const handleOpenAlertsActivity = () => {
    trackAlertsActivityBannerClickTry({
      ...getEventPayload(),
      referrer: window.location.pathname,
    });
    // Navigation handled by LinkButton href
  };

  const handleDismiss = () => {
    const dismissedUntil = dismissBanner();
    trackAlertsActivityBannerDismiss({
      ...getEventPayload(),
      dismissed_until: dismissedUntil,
    });
  };

  return (
    <Alert
      severity="info"
      title={t('alerting.alerts-activity-banner.title', 'Alert Activity is now available!')}
      onRemove={handleDismiss}
      className={styles.banner}
      role="region"
      aria-labelledby="alerts-activity-banner-title"
    >
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="alerting.alerts-activity-banner.description">
            A brand new page is now available to handle operational work for your Grafana-managed alert rules. Find out
            what alerts are firing, explore historical information, filter and group to enhance your triage and root
            cause analysis.
          </Trans>
        </Text>

        {isDMAStack && (
          <Text color="secondary" italic>
            <Trans i18nKey="alerting.alerts-activity-banner.dma-note">
              Some triage features may be limited on your stack.
            </Trans>
          </Text>
        )}

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
