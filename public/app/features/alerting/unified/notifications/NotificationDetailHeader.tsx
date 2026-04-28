import { css } from '@emotion/css';

import { type CreateNotificationqueryNotificationEntry } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { type GrafanaTheme2, dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, Tooltip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { StateTag } from '../components/StateTag';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface NotificationHeaderProps {
  notification: NotificationEntry;
}

export function NotificationHeader({ notification }: NotificationHeaderProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.headerRow}>
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
    </div>
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

export function formatDuration(durationNs: number): string {
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
});
