import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { CreateNotificationqueryNotificationEntry } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

import { EventState } from '../../components/rules/central-state-history/EventListSceneObject';
import { LogRecord } from '../../components/rules/state-history/common';
import { INTEGRATION_ICONS } from '../../types/contact-points';

import { dateFormatter, formatDuration, noop } from './timelineUtils';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface TimelineGroup {
  timestamp: number;
  type: 'state-change' | 'orphan-notifications';
  previous?: GrafanaAlertStateWithReason;
  current?: GrafanaAlertStateWithReason;
  notifications: NotificationEntry[];
}

function buildTimelineGroups(records: LogRecord[], notifications: NotificationEntry[]): TimelineGroup[] {
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

  const groups: TimelineGroup[] = [...stateGroups].reverse();

  if (orphanNotifications.length > 0) {
    groups.push({
      timestamp: new Date(orphanNotifications[0].timestamp).getTime(),
      type: 'orphan-notifications',
      notifications: orphanNotifications,
    });
  }

  return groups;
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

function buildTimelineEntries(groups: TimelineGroup[]): TimelineEntry[] {
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

export function InstanceTimeline({ records, notifications }: InstanceTimelineProps) {
  const styles = useStyles2(getStyles);
  const groups = useMemo(() => buildTimelineGroups(records, notifications), [records, notifications]);
  const entries = useMemo(() => buildTimelineEntries(groups), [groups]);

  if (entries.length === 0) {
    return (
      <Text color="secondary">
        {t('alerting.instance-details.timeline-empty', 'No events found for this time range')}
      </Text>
    );
  }

  return (
    <div className={styles.timeline}>
      {entries.map((entry, index) => (
        <div key={`${entry.type}-${entry.timestamp}-${index}`} className={styles.groupRow}>
          <div className={styles.timestampCol}>
            <Text variant="bodySmall" color="secondary">
              {dateFormatter.format(new Date(entry.timestamp))}
            </Text>
          </div>

          <div className={styles.connectorCol}>
            <div className={entry.type === 'notifications' ? styles.dotNotification : styles.dot} />
            {index < entries.length - 1 && <div className={styles.connectorLine} />}
          </div>

          <div className={styles.contentCol}>
            {entry.type === 'notifications' && entry.notifications && (
              <NotificationSummary notifications={entry.notifications} />
            )}

            {entry.type === 'state-change' && entry.previous && entry.current && (
              <div className={styles.stateChangeContent}>
                <EventState state={entry.previous} showLabel addFilter={noop} type="from" />
                <Icon name="arrow-right" size="sm" />
                <EventState state={entry.current} showLabel addFilter={noop} type="to" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationSummary({ notifications }: { notifications: NotificationEntry[] }) {
  const byStatus = useMemo(() => {
    const groups: Record<string, NotificationEntry[]> = {};
    for (const n of notifications) {
      const key = n.status;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(n);
    }
    return Object.entries(groups);
  }, [notifications]);

  return (
    <Stack direction="column" gap={0.5}>
      {byStatus.map(([status, items]) => (
        <NotificationStatusGroup key={status} status={status} notifications={items} />
      ))}
    </Stack>
  );
}

function NotificationStatusGroup({ status, notifications }: { status: string; notifications: NotificationEntry[] }) {
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

  let outcomeLabel: string;
  if (failedCount === 0) {
    outcomeLabel =
      successCount === 1
        ? t('alerting.instance-details.timeline-all-delivered', 'delivered')
        : t('alerting.instance-details.timeline-all-delivered-plural', 'all delivered');
  } else if (successCount === 0) {
    outcomeLabel =
      failedCount === 1
        ? t('alerting.instance-details.timeline-all-failed', 'failed')
        : t('alerting.instance-details.timeline-all-failed-plural', 'all failed');
  } else {
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
    <div className={styles.notificationSummaryWrapper}>
      <button className={cx(styles.summaryRowBase, variantStyle)} onClick={() => setExpanded(!expanded)} type="button">
        <Stack direction="row" alignItems="center" gap={1}>
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
          <Stack direction="row" gap={0.5} alignItems="center">
            <Text variant="bodySmall" color="secondary">
              →
            </Text>
            {integrations.map((integration) => (
              <IntegrationIcon key={integration} integration={integration} />
            ))}
            <Text variant="bodySmall">{receiverLabel}</Text>
          </Stack>
          <Text variant="bodySmall" color={hasFailures ? 'error' : 'success'}>
            ({outcomeLabel})
          </Text>
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
      <div className={styles.detailTime}>
        <Text variant="bodySmall" color="secondary">
          {dateFormatter.format(new Date(notification.timestamp))}
        </Text>
      </div>
      <div className={styles.detailReceiver}>
        <Stack direction="row" gap={1} alignItems="center">
          <IntegrationIcon integration={notification.integration} />
          <Text variant="bodySmall" truncate>
            {notification.receiver}
          </Text>
          <Text variant="bodySmall" color="secondary">
            ({receiverTypeNames[notification.integration] ?? notification.integration})
          </Text>
        </Stack>
      </div>
      <div className={styles.detailOutcome}>
        {isSuccess ? (
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon name="check-circle" size="sm" className={styles.successIcon} />
            <Text variant="bodySmall" color="success">
              {t('alerting.instance-details.timeline-delivered', 'Delivered')}
            </Text>
          </Stack>
        ) : (
          <Tooltip
            content={notification.error || t('alerting.instance-details.timeline-unknown-error', 'Unknown error')}
          >
            <Stack direction="row" gap={0.5} alignItems="center">
              <Icon name="exclamation-circle" size="sm" className={styles.errorIcon} />
              <Text variant="bodySmall" color="error">
                {t('alerting.instance-details.timeline-failed', 'Failed')}
              </Text>
            </Stack>
          </Tooltip>
        )}
      </div>
      <div className={styles.detailDuration}>
        <Text variant="bodySmall" color="secondary">
          {formatDuration(notification.duration)}
        </Text>
      </div>
    </div>
  );
}

function IntegrationIcon({ integration }: { integration: string }) {
  return <Icon name={INTEGRATION_ICONS[integration] || 'bell'} size="sm" />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  timeline: css({
    display: 'flex',
    flexDirection: 'column',
  }),

  groupRow: css({
    display: 'flex',
    flexDirection: 'row',
  }),

  timestampCol: css({
    width: '140px',
    flexShrink: 0,
    paddingTop: theme.spacing(0.5),
    textAlign: 'right',
    paddingRight: theme.spacing(1.5),
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

  dotNotification: css({
    width: '10px',
    height: '10px',
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.primary.main,
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

  stateChangeContent: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    paddingTop: theme.spacing(0.25),
  }),

  notificationSummaryWrapper: css({
    marginTop: theme.spacing(1),
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing(0.5, 1.5),
    '&:not(:last-child)': {
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
  }),

  detailTime: css({
    width: '140px',
    flexShrink: 0,
  }),

  detailReceiver: css({
    flex: 1,
    minWidth: 0,
  }),

  detailOutcome: css({
    width: '100px',
    flexShrink: 0,
  }),

  detailDuration: css({
    width: '80px',
    flexShrink: 0,
    textAlign: 'right',
  }),

  successIcon: css({
    color: theme.colors.success.main,
  }),

  errorIcon: css({
    color: theme.colors.error.main,
  }),
});
