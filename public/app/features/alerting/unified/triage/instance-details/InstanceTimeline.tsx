import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import {
  CreateNotificationqueryNotificationEntry,
  CreateNotificationqueryNotificationStatus,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, LinkButton, RadioButtonGroup, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

import { EventState } from '../../components/rules/central-state-history/EventListSceneObject';
import { LogRecord } from '../../components/rules/state-history/common';
import { INTEGRATION_ICONS } from '../../types/contact-points';
import { formatPrometheusDuration } from '../../utils/time';
import { createRelativeUrl } from '../../utils/url';

import { dateFormatter, noop } from './timelineUtils';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface TimelineGroup {
  timestamp: number;
  type: 'state-change' | 'orphan-notifications';
  previous?: GrafanaAlertStateWithReason;
  current?: GrafanaAlertStateWithReason;
  notifications: NotificationEntry[];
}

/**
 * Groups notifications under the most recent preceding state change.
 *
 * Each notification is assigned to the latest state change whose timestamp is <= the notification's timestamp.
 * Notifications that predate all state changes are collected as "orphan" notifications.
 *
 * Note: state changes and notifications come from different sources, so minor clock skew
 * may cause a notification to be grouped with a slightly earlier or later state change.
 */
export function buildTimelineGroups(records: LogRecord[], notifications: NotificationEntry[]): TimelineGroup[] {
  const chronological = [...records].sort((a, b) => a.timestamp - b.timestamp);

  const stateGroups: TimelineGroup[] = chronological.map((record) => ({
    timestamp: record.timestamp,
    type: 'state-change',
    previous: record.line.previous,
    current: record.line.current,
    notifications: [],
  }));

  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const orphanNotifications: NotificationEntry[] = [];

  for (const n of sortedNotifications) {
    const nTime = new Date(n.timestamp).getTime();

    let assignedIdx = -1;
    for (let i = stateGroups.length - 1; i >= 0; i--) {
      if (stateGroups[i].timestamp <= nTime) {
        assignedIdx = i;
        break;
      }
    }

    if (assignedIdx >= 0) {
      stateGroups[assignedIdx].notifications.push(n);
    } else {
      orphanNotifications.push(n);
    }
  }

  stateGroups.reverse();

  if (orphanNotifications.length > 0) {
    stateGroups.push({
      timestamp: new Date(orphanNotifications[0].timestamp).getTime(),
      type: 'orphan-notifications',
      notifications: orphanNotifications,
    });
  }

  return stateGroups;
}

interface InstanceTimelineProps {
  records: LogRecord[];
  notifications: NotificationEntry[];
}

interface TimelineEntry {
  timestamp: number;
  type: 'state-change' | 'notifications';
  previous?: GrafanaAlertStateWithReason;
  current?: GrafanaAlertStateWithReason;
  notifications?: NotificationEntry[];
}

export function buildTimelineEntries(groups: TimelineGroup[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const group of groups) {
    if (group.notifications.length > 0) {
      const lastNotification = group.notifications[group.notifications.length - 1];
      entries.push({
        timestamp: new Date(lastNotification.timestamp).getTime(),
        type: 'notifications',
        notifications: group.notifications,
      });
    }

    if (group.type === 'state-change' && group.previous && group.current) {
      entries.push({
        timestamp: group.timestamp,
        type: 'state-change',
        previous: group.previous,
        current: group.current,
      });
    }
  }

  return entries;
}

function EntryDot({ entry }: { entry: TimelineEntry }) {
  const styles = useStyles2(getStyles);

  if (entry.type !== 'notifications' || !entry.notifications) {
    return <div className={styles.dot} />;
  }
  const hasFailures = entry.notifications.some((n) => n.outcome !== 'success');
  if (hasFailures) {
    return <div className={styles.dotWarning} />;
  }
  const isFiring = entry.notifications.some((n) => n.status === 'firing');
  return <div className={isFiring ? styles.dotFiring : styles.dotResolved} />;
}

type TimelineFilter = 'all' | 'states' | 'notifications';

export function InstanceTimeline({ records, notifications }: InstanceTimelineProps) {
  const styles = useStyles2(getStyles);
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const filterOptions = [
    { label: t('alerting.instance-details.timeline-filter-all', 'All'), value: 'all' as const },
    { label: t('alerting.instance-details.timeline-filter-states', 'State changes'), value: 'states' as const },
    {
      label: t('alerting.instance-details.timeline-filter-notifications', 'Notifications'),
      value: 'notifications' as const,
    },
  ];

  const groups = useMemo(() => buildTimelineGroups(records, notifications), [records, notifications]);
  const allEntries = useMemo(() => buildTimelineEntries(groups), [groups]);

  const entries = useMemo(() => {
    if (filter === 'all') {
      return allEntries;
    }
    if (filter === 'states') {
      return allEntries.filter((e) => e.type === 'state-change');
    }
    return allEntries.filter((e) => e.type === 'notifications');
  }, [allEntries, filter]);

  if (allEntries.length === 0) {
    return (
      <Text color="secondary">
        {t('alerting.instance-details.timeline-empty', 'No events found for this time range')}
      </Text>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <RadioButtonGroup options={filterOptions} value={filter} onChange={setFilter} size="sm" />

      {entries.length === 0 ? (
        <Text color="secondary">
          {t('alerting.instance-details.timeline-filter-empty', 'No matching events for this filter')}
        </Text>
      ) : (
        <Stack direction="column">
          {entries.map((entry, index) => (
            <Stack key={`${entry.type}-${entry.timestamp}-${index}`} direction="row">
              <div className={styles.timestampCol}>
                <Text variant="bodySmall" color="secondary">
                  {dateFormatter.format(new Date(entry.timestamp))}
                </Text>
              </div>

              <div className={styles.connectorCol}>
                <EntryDot entry={entry} />
                {index < entries.length - 1 && <div className={styles.connectorLine} />}
              </div>

              <div className={styles.contentCol}>
                {entry.type === 'notifications' && entry.notifications && (
                  <NotificationSummary notifications={entry.notifications} />
                )}

                {entry.type === 'state-change' && entry.previous && entry.current && (
                  <Stack direction="row" alignItems="center" gap={1}>
                    <EventState state={entry.previous} showLabel addFilter={noop} type="from" />
                    <Icon name="arrow-right" size="sm" />
                    <EventState state={entry.current} showLabel addFilter={noop} type="to" />
                  </Stack>
                )}
              </div>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function NotificationSummary({ notifications }: { notifications: NotificationEntry[] }) {
  const byStatus = useMemo(() => {
    const grouped: Record<CreateNotificationqueryNotificationStatus, NotificationEntry[]> = {
      firing: [],
      resolved: [],
    };
    for (const n of notifications) {
      grouped[n.status].push(n);
    }
    return Object.entries(grouped).filter(
      (entry): entry is [CreateNotificationqueryNotificationStatus, NotificationEntry[]] => entry[1].length > 0
    );
  }, [notifications]);

  return (
    <Stack direction="column" gap={0.5}>
      {byStatus.map(([status, items]) => (
        <NotificationStatusGroup key={status} status={status} notifications={items} />
      ))}
    </Stack>
  );
}

function NotificationStatusGroup({
  status,
  notifications,
}: {
  status: CreateNotificationqueryNotificationStatus;
  notifications: NotificationEntry[];
}) {
  const styles = useStyles2(getStyles);
  const [expanded, setExpanded] = useState(false);

  const successCount = notifications.filter((n) => n.outcome === 'success').length;
  const failedCount = notifications.length - successCount;

  const receivers = [...new Set(notifications.map((n) => n.receiver))];
  const receiverLabel =
    receivers.length === 1
      ? receivers[0]
      : t('alerting.instance-details.timeline-n-receivers', '{{count}} receivers', { count: receivers.length });
  const integrations = [...new Set(notifications.map((n) => n.integration))];

  let outcomeLabel: string | undefined;
  if (failedCount > 0 && successCount === 0) {
    outcomeLabel =
      failedCount === 1
        ? t('alerting.instance-details.timeline-all-failed', 'failed')
        : t('alerting.instance-details.timeline-all-failed-plural', 'all failed');
  } else if (failedCount > 0) {
    outcomeLabel = t(
      'alerting.instance-details.timeline-mixed-outcome',
      '{{successCount}} delivered, {{failedCount}} failed',
      { successCount, failedCount }
    );
  }

  const isFiring = status === 'firing';
  const hasFailures = failedCount > 0;

  const statusLabel = isFiring
    ? t('alerting.instance-details.timeline-status-firing', 'Firing')
    : t('alerting.instance-details.timeline-status-resolved', 'Resolved');

  let variantStyle = styles.summaryRowFiring;
  if (hasFailures) {
    variantStyle = styles.summaryRowError;
  } else if (!isFiring) {
    variantStyle = styles.summaryRowResolved;
  }

  return (
    <div>
      <button
        className={cx(styles.summaryRowBase, variantStyle)}
        onClick={() => setExpanded(!expanded)}
        type="button"
        aria-expanded={expanded}
        aria-label={t('alerting.instance-details.timeline-toggle-notifications', 'Toggle notification details')}
      >
        <Stack direction="row" alignItems="center" gap={0.5} wrap="wrap">
          <Icon name={isFiring ? 'fire' : 'check-circle'} size="sm" />
          <Text variant="bodySmall" weight="medium">
            {statusLabel}
          </Text>
          <Text variant="bodySmall" color="secondary">
            ·
          </Text>
          <Text variant="bodySmall">
            {notifications.length === 1
              ? t('alerting.instance-details.timeline-one-notification', '1 notification')
              : t('alerting.instance-details.timeline-n-notifications', '{{count}} notifications', {
                  count: notifications.length,
                })}
          </Text>
          <Text variant="bodySmall" color="secondary">
            →
          </Text>
          {integrations.map((integration) => (
            <IntegrationIcon key={integration} integration={integration} />
          ))}
          <Text variant="bodySmall" truncate>
            {receiverLabel}
          </Text>
          {outcomeLabel && (
            <Text variant="bodySmall" color="error">
              ({outcomeLabel})
            </Text>
          )}
        </Stack>
        <Icon name={expanded ? 'angle-up' : 'angle-down'} size="sm" />
      </button>

      {expanded && (
        <div className={styles.notificationDetails}>
          {notifications.map((notification) => (
            <NotificationRow key={notification.uuid} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ notification }: { notification: NotificationEntry }) {
  const styles = useStyles2(getStyles);
  const isSuccess = notification.outcome === 'success';

  return (
    <div className={styles.notificationDetailRow}>
      <div className={styles.notificationRowMain}>
        <Text variant="bodySmall" color="secondary">
          {dateFormatter.format(new Date(notification.timestamp))}
        </Text>
        <Stack direction="row" gap={0.5} alignItems="center">
          <IntegrationIcon integration={notification.integration} />
          <Text variant="bodySmall" weight="medium" truncate>
            {notification.receiver}
          </Text>
          <Text variant="bodySmall" color="secondary">
            ({receiverTypeNames[notification.integration] ?? notification.integration})
          </Text>
        </Stack>
        {isSuccess ? (
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon name="check-circle" size="sm" className={styles.successIcon} />
            <Text variant="bodySmall" color="success">
              {t('alerting.instance-details.timeline-delivered', 'Delivered')}
            </Text>
          </Stack>
        ) : (
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon name="exclamation-circle" size="sm" className={styles.errorIcon} />
            <Text variant="bodySmall" color="error">
              {t('alerting.instance-details.timeline-failed', 'Failed')}
            </Text>
          </Stack>
        )}
        <Text variant="bodySmall" color="secondary">
          {formatPrometheusDuration(Math.floor(notification.duration / 1_000_000))}
        </Text>
        <Tooltip content={t('alerting.instance-details.view-notification-tooltip', 'View full notification details')}>
          <LinkButton
            variant="secondary"
            size="sm"
            icon="eye"
            href={createRelativeUrl(
              `/alerting/notifications-history/view/${notification.uuid}?ts=${new Date(notification.timestamp).getTime()}`
            )}
          >
            {t('alerting.instance-details.view-notification-detail', 'Details')}
          </LinkButton>
        </Tooltip>
      </div>
      {!isSuccess && notification.error && (
        <div className={styles.notificationRowError}>
          <Icon name="exclamation-triangle" size="xs" className={styles.errorIcon} />
          <Text variant="bodySmall" color="secondary" truncate={false}>
            {notification.error}
          </Text>
        </div>
      )}
    </div>
  );
}

function IntegrationIcon({ integration }: { integration: string }) {
  return <Icon name={INTEGRATION_ICONS[integration] || 'bell'} size="sm" />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  timestampCol: css({
    width: 'auto',
    flexShrink: 0,
    paddingTop: theme.spacing(0.5),
    textAlign: 'right',
    paddingRight: theme.spacing(1.5),
    whiteSpace: 'nowrap',
  }),

  connectorCol: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: theme.spacing(2),
    flexShrink: 0,
  }),

  dot: css({
    width: '10px',
    height: '10px',
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.text.secondary,
    flexShrink: 0,
    marginTop: theme.spacing(0.75),
  }),

  dotFiring: css({
    width: '10px',
    height: '10px',
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.error.main,
    flexShrink: 0,
    marginTop: theme.spacing(0.75),
  }),

  dotResolved: css({
    width: '10px',
    height: '10px',
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.success.main,
    flexShrink: 0,
    marginTop: theme.spacing(0.75),
  }),

  dotWarning: css({
    width: '10px',
    height: '10px',
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.warning.main,
    flexShrink: 0,
    marginTop: theme.spacing(0.75),
  }),

  connectorLine: css({
    width: '2px',
    flex: 1,
    backgroundColor: theme.colors.border.medium,
    marginTop: theme.spacing(0.5),
  }),

  contentCol: css({
    flex: 1,
    paddingLeft: theme.spacing(1.5),
    paddingBottom: theme.spacing(2),
    minWidth: 0,
  }),

  summaryRowBase: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),

  summaryRowFiring: css({
    border: `1px solid ${theme.colors.error.border}`,
    backgroundColor: theme.colors.error.transparent,
  }),

  summaryRowResolved: css({
    border: `1px solid ${theme.colors.success.border}`,
    backgroundColor: theme.colors.success.transparent,
  }),

  summaryRowError: css({
    border: `1px solid ${theme.colors.warning.border}`,
    backgroundColor: theme.colors.warning.transparent,
  }),

  notificationDetails: css({
    marginTop: theme.spacing(0.5),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),

  notificationDetailRow: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(0.75, 1.5),
    gap: theme.spacing(0.5),
    '&:not(:last-child)': {
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
  }),

  notificationRowMain: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5, 1.5),
  }),

  notificationRowError: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    paddingLeft: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),

  successIcon: css({
    color: theme.colors.success.main,
  }),

  errorIcon: css({
    color: theme.colors.error.main,
  }),
});
