import { css, cx } from '@emotion/css';

import { type CreateNotificationqueryNotificationEntry } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { type GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Icon, type IconName, LoadingPlaceholder, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';

import { INTEGRATION_ICONS } from '../types/contact-points';

import { NotificationState } from './NotificationDetailHeader';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface RelatedNotificationsSidebarProps {
  currentNotification: NotificationEntry;
  relatedNotifications: NotificationEntry[];
  isLoading: boolean;
}

interface BatchGroup {
  pipelineTime: string;
  timestamp: string;
  status: 'firing' | 'resolved';
  notifications: NotificationEntry[];
  hasCurrent: boolean;
  failedCount: number;
  allRetry: boolean;
  receiver: string | null;
}

function groupByBatch(currentNotification: NotificationEntry, relatedNotifications: NotificationEntry[]): BatchGroup[] {
  const all = [currentNotification, ...relatedNotifications];
  const groups = new Map<string, NotificationEntry[]>();

  for (const n of all) {
    const key = n.pipelineTime;
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([pipelineTime, notifications]) => {
      const sorted = [...notifications].sort((a, b) => a.integrationIndex - b.integrationIndex);
      const receivers = new Set(sorted.map((n) => n.receiver));
      return {
        pipelineTime,
        timestamp: sorted[0].timestamp,
        status: sorted[0].status,
        notifications: sorted,
        hasCurrent: sorted.some((n) => n.uuid === currentNotification.uuid),
        failedCount: sorted.filter((n) => n.outcome === 'error').length,
        allRetry: sorted.every((n) => n.retry),
        receiver: receivers.size === 1 ? sorted[0].receiver : null,
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function RelatedNotificationsSidebar({
  currentNotification,
  relatedNotifications,
  isLoading,
}: RelatedNotificationsSidebarProps) {
  const styles = useStyles2(getStyles);

  const batches = groupByBatch(currentNotification, relatedNotifications);

  if (isLoading) {
    return (
      <LoadingPlaceholder
        text={t('alerting.notification-detail.related-loading', 'Loading related notifications...')}
      />
    );
  }

  return (
    <Stack direction="column" gap={1}>
      {batches.map((batch) => (
        <div key={batch.pipelineTime} className={cx(styles.relatedRow, batch.hasCurrent && styles.relatedRowCurrent)}>
          <Stack direction="column" gap={0.5}>
            <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
              <Text variant="bodySmall" color="secondary">
                {dateTimeFormat(batch.timestamp)}
              </Text>
              {batch.hasCurrent && <Badge color="blue" text={t('alerting.notification-detail.current', 'Current')} />}
              {batch.allRetry && (
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
            <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
              <NotificationState status={batch.status} />
              {batch.receiver && (
                <Text variant="bodySmall" weight="medium">
                  {batch.receiver}
                </Text>
              )}
              <Text variant="bodySmall" color="secondary">
                ·
              </Text>
              <Text variant="bodySmall" color="secondary">
                {batch.notifications.length === 1
                  ? t('alerting.notification-detail.batch-count-one', '1 delivery')
                  : t('alerting.notification-detail.batch-count-many', '{{count}} deliveries', {
                      count: batch.notifications.length,
                    })}
              </Text>
              {batch.failedCount > 0 ? (
                <Stack direction="row" gap={0.5} alignItems="center">
                  <Icon name="exclamation-circle" size="sm" className={styles.errorIcon} />
                  <Text variant="bodySmall" color="error">
                    {t('alerting.notification-detail.batch-failed', '{{count}} failed', {
                      count: batch.failedCount,
                    })}
                  </Text>
                </Stack>
              ) : (
                <Stack direction="row" gap={0.5} alignItems="center">
                  <Icon name="check-circle" size="sm" className={styles.successIcon} />
                  <Text variant="bodySmall" color="success">
                    {t('alerting.notification-detail.batch-all-ok', 'all succeeded')}
                  </Text>
                </Stack>
              )}
            </Stack>
            {batch.notifications.map((n) => {
              const nIcon: IconName = INTEGRATION_ICONS[n.integration] || 'bell';
              const typeName = receiverTypeNames[n.integration] ?? n.integration;

              return (
                <div key={n.uuid} className={styles.batchItem}>
                  <Stack direction="row" gap={0.5} alignItems="center">
                    <Icon name={nIcon} size="sm" />
                    {!batch.receiver && <Text variant="bodySmall">{n.receiver}</Text>}
                    <Text variant="bodySmall" color="secondary">
                      {typeName} #{n.integrationIndex + 1}
                    </Text>
                  </Stack>
                  {n.outcome === 'error' ? (
                    <Icon name="exclamation-circle" size="xs" className={styles.errorIcon} />
                  ) : (
                    <Icon name="check-circle" size="xs" className={styles.successIcon} />
                  )}
                </div>
              );
            })}
          </Stack>
        </div>
      ))}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  relatedRow: css({
    display: 'block',
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  relatedRowCurrent: css({
    borderColor: theme.colors.primary.border,
    backgroundColor: theme.colors.primary.transparent,
  }),
  batchItem: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    marginLeft: theme.spacing(1),
    borderLeft: `2px solid ${theme.colors.border.medium}`,
    textDecoration: 'none',
    color: 'inherit',
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
