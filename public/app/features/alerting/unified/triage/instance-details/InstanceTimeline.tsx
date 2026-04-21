import { css, cx } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import {
  type CreateNotificationqueryNotificationEntry,
  type CreateNotificationqueryNotificationStatus,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Icon, LinkButton, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { type GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

import { StateTag } from '../../components/StateTag';
import { EventState } from '../../components/rules/central-state-history/EventListSceneObject';
import { type LogRecord } from '../../components/rules/state-history/common';
import { INTEGRATION_ICONS } from '../../types/contact-points';
import { formatPrometheusDuration } from '../../utils/time';
import { createRelativeUrl } from '../../utils/url';

import { formatTimelineDate, noop } from './timelineUtils';

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

/**
 * Counts unique integrations that delivered successfully vs failed.
 *
 * An integration is identified by `integration:integrationIndex`. If any attempt
 * (including retries) for an integration succeeded, it counts as delivered.
 */
export function computeIntegrationOutcomes(notifications: NotificationEntry[]): {
  delivered: number;
  failed: number;
} {
  const best = new Map<string, boolean>();
  for (const n of notifications) {
    const key = `${n.integration}:${n.integrationIndex}`;
    if (n.outcome === 'success') {
      best.set(key, true);
    } else if (!best.has(key)) {
      best.set(key, false);
    }
  }
  let delivered = 0;
  let failed = 0;
  for (const success of best.values()) {
    if (success) {
      delivered++;
    } else {
      failed++;
    }
  }
  return { delivered, failed };
}

function EntryDot({ entry }: { entry: TimelineEntry }) {
  const styles = useStyles2(getStyles);

  if (entry.type === 'state-change') {
    if (entry.current === 'Pending') {
      return <div className={cx(styles.dotBase, styles.dotPending)} />;
    }
    const isFiringTransition = entry.current === 'Alerting' || entry.current === 'NoData' || entry.current === 'Error';
    return <div className={cx(styles.dotBase, isFiringTransition ? styles.dotFiring : styles.dotResolved)} />;
  }

  if (!entry.notifications) {
    return <div className={cx(styles.dotBase, styles.dotDefault)} />;
  }

  const allFailed = entry.notifications.every((n) => n.outcome === 'error');
  const someFailed = entry.notifications.some((n) => n.outcome === 'error');

  if (allFailed) {
    return (
      <Tooltip content={t('alerting.instance-details.timeline-dot-all-failed', 'All notifications failed')}>
        <Icon name="exclamation-circle" size="sm" className={styles.dotIconError} />
      </Tooltip>
    );
  }
  if (someFailed) {
    return (
      <Tooltip content={t('alerting.instance-details.timeline-dot-some-failed', 'Some notifications failed')}>
        <Icon name="exclamation-circle" size="sm" className={styles.dotIconError} />
      </Tooltip>
    );
  }

  return <div className={cx(styles.dotBase, styles.dotDefault)} />;
}

export type TimelineFilter = 'all' | 'states' | 'notifications';

interface InstanceTimelineProps {
  records: LogRecord[];
  notifications: NotificationEntry[];
  filter?: TimelineFilter;
  onOpenContactPoint?: (receiverName: string) => void;
}

export function InstanceTimeline({
  records,
  notifications,
  filter = 'all',
  onOpenContactPoint,
}: InstanceTimelineProps) {
  const styles = useStyles2(getStyles);

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
      {entries.length === 0 ? (
        <Text color="secondary">
          {t('alerting.instance-details.timeline-filter-empty', 'No matching events for this filter')}
        </Text>
      ) : (
        <div className={styles.timelineGrid}>
          {entries.map((entry, index) => (
            <React.Fragment key={`${entry.type}-${entry.timestamp}-${index}`}>
              <div className={styles.timestampCell}>
                <Text variant="bodySmall" color="secondary">
                  {formatTimelineDate(entry.timestamp)}
                </Text>
              </div>
              <div className={styles.dotCell}>
                <EntryDot entry={entry} />
              </div>
              <div className={styles.contentCell}>
                {entry.type === 'notifications' && entry.notifications && (
                  <NotificationSummary notifications={entry.notifications} onOpenContactPoint={onOpenContactPoint} />
                )}
                {entry.type === 'state-change' && entry.previous && entry.current && (
                  <div className={styles.stateChangeRow}>
                    <EventState state={entry.previous} showLabel addFilter={noop} type="from" />
                    <Icon name="arrow-right" size="sm" />
                    <EventState state={entry.current} showLabel addFilter={noop} type="to" />
                  </div>
                )}
              </div>
              {index < entries.length - 1 && (
                <>
                  <div />
                  <div className={styles.connectorCell}>
                    <div className={styles.connectorLine} />
                  </div>
                  <div />
                </>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </Stack>
  );
}

/** Opens the contact point in-app or links to notifications filtered by receiver (sibling to expand control — avoids nested interactive elements). */
function ReceiverLinkOrButton({
  receiverName,
  label,
  onOpenContactPoint,
}: {
  receiverName: string;
  label: string;
  onOpenContactPoint?: (receiverName: string) => void;
}) {
  const styles = useStyles2(getStyles);

  if (onOpenContactPoint) {
    return (
      <Button
        type="button"
        variant="secondary"
        fill="text"
        size="sm"
        className={styles.receiverAsideButton}
        onClick={() => onOpenContactPoint(receiverName)}
      >
        {label}
      </Button>
    );
  }

  return (
    <a
      href={textUtil.sanitizeUrl(
        createRelativeUrl(`/alerting/notifications?search=${encodeURIComponent(receiverName)}`)
      )}
      className={styles.receiverLink}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Text variant="bodySmall">{label}</Text>
    </a>
  );
}

function NotificationSummary({
  notifications,
  onOpenContactPoint,
}: {
  notifications: NotificationEntry[];
  onOpenContactPoint?: (receiverName: string) => void;
}) {
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
        <NotificationStatusGroup
          key={status}
          status={status}
          notifications={items}
          onOpenContactPoint={onOpenContactPoint}
        />
      ))}
    </Stack>
  );
}

function NotificationStatusGroup({
  status,
  notifications,
  onOpenContactPoint,
}: {
  status: CreateNotificationqueryNotificationStatus;
  notifications: NotificationEntry[];
  onOpenContactPoint?: (receiverName: string) => void;
}) {
  const styles = useStyles2(getStyles);
  const [expanded, setExpanded] = useState(false);

  const integrationOutcomes = useMemo(() => computeIntegrationOutcomes(notifications), [notifications]);

  const { delivered: successCount, failed: failedCount } = integrationOutcomes;

  const uniqueReceivers = [...new Set(notifications.map((n) => n.receiver))];
  const receiverLabel =
    uniqueReceivers.length === 1
      ? uniqueReceivers[0]
      : t('alerting.instance-details.timeline-n-uniqueReceivers', '{{count}} uniqueReceivers', {
          count: uniqueReceivers.length,
        });

  let deliveryLabel: string | undefined;
  if (failedCount > 0 && successCount === 0) {
    deliveryLabel =
      failedCount === 1
        ? t('alerting.instance-details.timeline-all-failed', 'failed')
        : t('alerting.instance-details.timeline-all-failed-plural', 'all failed');
  } else if (failedCount > 0) {
    deliveryLabel = t(
      'alerting.instance-details.timeline-partial-failure',
      '{{successCount}} delivered, {{failedCount}} failed',
      { successCount, failedCount }
    );
  }

  const isFiring = status === 'firing';

  const statusLabel = isFiring
    ? t('alerting.instance-details.timeline-status-firing', 'Firing')
    : t('alerting.instance-details.timeline-status-resolved', 'Resolved');

  const variantStyle = isFiring ? styles.summaryRowFiring : styles.summaryRowResolved;

  return (
    <div>
      <div className={styles.summaryRowOuter}>
        <button
          className={cx(styles.summaryRowBase, variantStyle, styles.summaryExpandToggle)}
          onClick={() => setExpanded(!expanded)}
          type="button"
          aria-expanded={expanded}
          aria-label={t('alerting.instance-details.timeline-toggle-notifications', 'Toggle notification details')}
        >
          <Stack direction="row" alignItems="center" gap={0.5} wrap="wrap" flex={1} minWidth={0}>
            <StateTag state={isFiring ? 'bad' : 'good'} size="sm">
              {statusLabel}{' '}
              <span className={styles.lowercaseText}>
                {t('alerting.instance-details.timeline-notification-label', 'notification')}
              </span>
            </StateTag>
            {deliveryLabel && (
              <>
                <Text variant="bodySmall" color="secondary">
                  ·
                </Text>
                <Icon name="exclamation-circle" size="sm" className={styles.errorIcon} />
                <Text variant="bodySmall" color="error" weight="medium">
                  {deliveryLabel}
                </Text>
              </>
            )}
            <Text variant="bodySmall" color="secondary">
              →
            </Text>
            <Icon name="at" size="sm" />
            {uniqueReceivers.length !== 1 && (
              <Text variant="bodySmall" truncate>
                {receiverLabel}
              </Text>
            )}
          </Stack>
          <Icon name={expanded ? 'angle-up' : 'angle-down'} size="sm" />
        </button>
        {uniqueReceivers.length === 1 && (
          <div className={styles.receiverAside}>
            <ReceiverLinkOrButton
              receiverName={uniqueReceivers[0]}
              label={receiverLabel}
              onOpenContactPoint={onOpenContactPoint}
            />
          </div>
        )}
      </div>

      {expanded && (
        <div className={styles.notificationDetails}>
          {[...notifications].reverse().map((notification) => (
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
          {formatTimelineDate(notification.timestamp)}
        </Text>
        <Stack direction="row" gap={0.5} alignItems="center">
          <IntegrationIcon integration={notification.integration} />
          <Text variant="bodySmall" weight="medium">
            {receiverTypeNames[notification.integration] ?? notification.integration} #
            {notification.integrationIndex + 1}
          </Text>
        </Stack>
        {isSuccess && (
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon name="check-circle" size="sm" className={styles.successIcon} />
            <Text variant="bodySmall" color="success">
              {t('alerting.instance-details.timeline-delivered', 'Delivered')}
            </Text>
          </Stack>
        )}
        <Text variant="bodySmall" color="secondary">
          {formatPrometheusDuration(Math.floor(notification.duration / 1_000_000))}
        </Text>
        {config.featureToggles.alertingNotificationHistoryDetail && (
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
        )}
      </div>
      {!isSuccess && (
        <div className={styles.notificationRowError}>
          <Icon name="exclamation-circle" size="sm" className={styles.errorIcon} />
          <Text variant="bodySmall" color="error" truncate={false}>
            {notification.error || t('alerting.instance-details.timeline-failed', 'Failed')}
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
  timelineGrid: css({
    display: 'grid',
    gridTemplateColumns: `auto ${theme.spacing(2)} 1fr`,
  }),

  timestampCell: css({
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'start',
    minHeight: theme.spacing(4),
    paddingRight: theme.spacing(1.5),
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  }),

  dotCell: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'start',
    minHeight: theme.spacing(4),
  }),

  contentCell: css({
    paddingLeft: theme.spacing(1.5),
    minWidth: 0,
  }),

  dotBase: css({
    width: '10px',
    height: '10px',
    borderRadius: theme.shape.radius.circle,
  }),

  dotDefault: css({
    backgroundColor: theme.colors.text.secondary,
  }),

  dotFiring: css({
    backgroundColor: theme.colors.error.main,
  }),

  dotResolved: css({
    backgroundColor: theme.colors.success.main,
  }),

  dotPending: css({
    backgroundColor: theme.colors.warning.main,
  }),

  dotIconError: css({
    color: theme.colors.error.main,
  }),

  stateChangeRow: css({
    display: 'flex',
    alignItems: 'center',
    minHeight: theme.spacing(4),
    gap: theme.spacing(1),
  }),

  connectorCell: css({
    display: 'flex',
    justifyContent: 'center',
  }),

  connectorLine: css({
    width: '2px',
    minHeight: theme.spacing(1.5),
    backgroundColor: theme.colors.border.medium,
  }),

  summaryRowOuter: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    flexWrap: 'wrap',
  }),

  summaryExpandToggle: css({
    flex: 1,
    minWidth: 0,
  }),

  receiverAside: css({
    flexShrink: 0,
  }),

  receiverAsideButton: css({
    fontWeight: theme.typography.fontWeightMedium,
    height: 'auto',
    minHeight: theme.spacing(3),
  }),

  summaryRowBase: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: theme.spacing(4),
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.shape.radius.default,
    border: 'none',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),

  summaryRowFiring: css({
    backgroundColor: theme.colors.error.transparent,
  }),

  summaryRowResolved: css({
    backgroundColor: theme.colors.success.transparent,
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

  receiverLink: css({
    color: theme.colors.text.link,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),

  lowercaseText: css({
    textTransform: 'none',
  }),
});
