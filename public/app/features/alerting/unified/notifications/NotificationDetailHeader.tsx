import { css } from '@emotion/css';

import { CreateNotificationqueryNotificationEntry } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaTheme2, dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, IconName, LinkButton, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';

import { StateTag } from '../components/StateTag';
import { INTEGRATION_ICONS } from '../types/contact-points';
import { makeLabelBasedSilenceLink } from '../utils/misc';
import { createRelativeUrl } from '../utils/url';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface NotificationHeaderProps {
  notification: NotificationEntry;
  relatedCount: number;
  failedRelatedCount: number;
  onOpenRelated: () => void;
}

export function NotificationHeader({
  notification,
  relatedCount,
  failedRelatedCount,
  onOpenRelated,
}: NotificationHeaderProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.headerRow}>
      <Stack direction="column" gap={1}>
        <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
          <NotificationState status={notification.status} />
          <Tooltip content={dateTimeFormat(notification.timestamp)}>
            <Text variant="bodySmall" color="secondary">
              {dateTimeFormatTimeAgo(notification.timestamp)}
            </Text>
          </Tooltip>
          <Text variant="bodySmall" color="secondary">
            ·
          </Text>
          <Text variant="bodySmall" color="secondary">
            {t('alerting.notification-detail.alert-count-inline', '{{count}} alert(s)', {
              count: notification.alertCount,
            })}
          </Text>
        </Stack>
        <QuickActions
          notification={notification}
          relatedCount={relatedCount}
          failedRelatedCount={failedRelatedCount}
          onOpenRelated={onOpenRelated}
        />
      </Stack>
      <DeliveryBadge notification={notification} />
    </div>
  );
}

function DeliveryBadge({ notification }: { notification: NotificationEntry }) {
  const styles = useStyles2(getStyles);
  const integrationIcon: IconName = INTEGRATION_ICONS[notification.integration] || 'bell';
  const isError = notification.outcome === 'error';

  return (
    <div className={isError ? styles.deliveryBadgeError : styles.deliveryBadgeSuccess}>
      <Stack direction="column" gap={0.5} alignItems="flex-end">
        <Stack direction="row" gap={0.5} alignItems="center">
          <Icon
            name={isError ? 'exclamation-circle' : 'check-circle'}
            className={isError ? styles.errorIcon : styles.successIcon}
          />
          <Text variant="h5">
            {isError
              ? t('alerting.notification-detail.delivery-failed', 'Delivery failed')
              : t('alerting.notification-detail.delivery-success', 'Delivered successfully')}
          </Text>
        </Stack>
        <Stack direction="row" gap={0.5} alignItems="center">
          <Icon name={integrationIcon} size="sm" />
          <Text variant="bodySmall" weight="medium">
            {notification.receiver}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {receiverTypeNames[notification.integration] ?? notification.integration} #
            {notification.integrationIndex + 1}
          </Text>
          <Text variant="bodySmall" color="secondary">
            ·
          </Text>
          <Text variant="bodySmall" color="secondary">
            {formatDuration(notification.duration)}
          </Text>
          {notification.retry && (
            <Tooltip
              content={t(
                'alerting.notification-detail.retry-tooltip',
                'This attempt was a retry of a previous attempt'
              )}
            >
              <Icon name="sync" size="sm" className={styles.subtleIcon} />
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </div>
  );
}

interface QuickActionsProps {
  notification: NotificationEntry;
  relatedCount: number;
  failedRelatedCount: number;
  onOpenRelated: () => void;
}

function QuickActions({ notification, relatedCount, failedRelatedCount, onOpenRelated }: QuickActionsProps) {
  return (
    <Stack direction="row" gap={1} wrap="wrap">
      <LinkButton
        variant="secondary"
        size="sm"
        icon="arrow-right"
        href={createRelativeUrl(`/alerting/notifications?search=${encodeURIComponent(notification.receiver)}`)}
      >
        {t('alerting.notification-detail.action-view-contact-point', 'View contact point')}
      </LinkButton>
      {notification.groupLabels && Object.keys(notification.groupLabels).length > 0 && (
        <LinkButton
          variant="secondary"
          size="sm"
          icon="bell-slash"
          href={makeLabelBasedSilenceLink('grafana', notification.groupLabels)}
        >
          {t('alerting.notification-detail.action-silence', 'Silence this group')}
        </LinkButton>
      )}
      <Button variant="secondary" size="sm" icon="history" onClick={onOpenRelated}>
        {failedRelatedCount > 0
          ? t('alerting.notification-detail.related-count-with-failures', '{{count}} related ({{failed}} failed)', {
              count: relatedCount,
              failed: failedRelatedCount,
            })
          : t('alerting.notification-detail.related-count', '{{count}} related notifications', {
              count: relatedCount,
            })}
      </Button>
    </Stack>
  );
}

export function NotificationState({ status }: { status: 'firing' | 'resolved' }) {
  const isFiring = status === 'firing';
  const statusText = isFiring
    ? t('alerting.notifications-list.status-firing', 'Firing')
    : t('alerting.notifications-list.status-resolved', 'Resolved');
  const state = isFiring ? 'bad' : 'good';
  return <StateTag state={state}>{statusText}</StateTag>;
}

function formatDuration(durationNs: number): string {
  if (durationNs < 1_000_000) {
    return `${(durationNs / 1000).toFixed(1)}µs`;
  } else if (durationNs < 1_000_000_000) {
    return `${(durationNs / 1_000_000).toFixed(1)}ms`;
  } else {
    return `${(durationNs / 1_000_000_000).toFixed(2)}s`;
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  headerRow: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  }),
  deliveryBadgeSuccess: css({
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.success.transparent,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.success.border}`,
    flexShrink: 0,
  }),
  deliveryBadgeError: css({
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.error.transparent,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.error.border}`,
    flexShrink: 0,
  }),
  successIcon: css({
    color: theme.colors.success.text,
  }),
  errorIcon: css({
    color: theme.colors.error.text,
  }),
  subtleIcon: css({
    color: theme.colors.text.secondary,
  }),
});
