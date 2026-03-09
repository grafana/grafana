import { css, cx } from '@emotion/css';
import { ReactNode, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { AlertLabels } from '@grafana/alerting/unstable';
import {
  CreateNotificationqueryNotificationEntry,
  CreateNotificationsqueryalertsNotificationEntryAlert,
  useCreateNotificationqueryMutation,
  useCreateNotificationsqueryalertsMutation,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaTheme2, dateTime } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  Button,
  Collapse,
  Drawer,
  Icon,
  IconName,
  LinkButton,
  LoadingPlaceholder,
  Stack,
  Text,
  TextLink,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { StateTag } from '../components/StateTag';
import { INTEGRATION_ICONS } from '../types/contact-points';
import { makeLabelBasedSilenceLink } from '../utils/misc';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

function pickHeadingLabel(groupLabels: Record<string, string> | undefined): string {
  if (!groupLabels || Object.keys(groupLabels).length === 0) {
    return 'Notification';
  }
  if (groupLabels.alertname) {
    return groupLabels.alertname;
  }
  if (groupLabels.service_name) {
    return groupLabels.service_name;
  }
  return Object.keys(groupLabels).sort()[0];
}

function NotificationDetailPage() {
  const { uuid, timestamp } = useParams<{ uuid: string; timestamp?: string }>();
  const [pageTitle, setPageTitle] = useState(t('alerting.notification-detail.page-title', 'View'));

  const pageNav = { text: pageTitle };

  return (
    <AlertingPageWrapper navId="alerts-notifications" pageNav={pageNav} isLoading={false}>
      {uuid ? (
        <NotificationDetail uuid={uuid} timestamp={timestamp} onTitleChange={setPageTitle} />
      ) : (
        <NotificationNotFound />
      )}
    </AlertingPageWrapper>
  );
}

function NotificationNotFound() {
  return (
    <Alert title={t('alerting.notification-detail.not-found-title', 'Notification not found')} severity="warning">
      <Trans i18nKey="alerting.notification-detail.not-found-body">
        No UUID was provided. Please navigate from the notifications list.
      </Trans>
    </Alert>
  );
}

interface NotificationDetailProps {
  uuid: string;
  timestamp?: string;
  onTitleChange: (title: string) => void;
}

function NotificationDetail({ uuid, timestamp, onTitleChange }: NotificationDetailProps) {
  const styles = useStyles2(getStyles);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [notification, setNotification] = useState<NotificationEntry | null | undefined>(undefined);
  const [relatedNotifications, setRelatedNotifications] = useState<NotificationEntry[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<CreateNotificationsqueryalertsNotificationEntryAlert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);

  const [fetchNotifications] = useCreateNotificationqueryMutation();
  const [fetchAlerts] = useCreateNotificationsqueryalertsMutation();

  useEffect(() => {
    // If a timestamp is provided, query a 1-second window around it.
    // Otherwise fall back to a 90-day window.
    const { from, to } = timestamp
      ? (() => {
          const ts = new Date(timestamp).getTime();
          return {
            from: new Date(ts - 1000).toISOString(),
            to: new Date(ts + 1000).toISOString(),
          };
        })()
      : {
          from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        };

    fetchNotifications({
      createNotificationqueryRequestBody: { from, to, limit: 1000 },
    })
      .unwrap()
      .then((result) => {
        const found = (result.entries ?? []).find((e) => e.uuid === uuid) ?? null;
        setNotification(found);
        if (found) {
          onTitleChange(pickHeadingLabel(found.groupLabels));
        }

        if (found) {
          // Related notifications: ±7 days around the found notification's timestamp
          const foundTs = new Date(found.timestamp).getTime();
          const relFrom = new Date(foundTs - 7 * 24 * 60 * 60 * 1000).toISOString();
          const relTo = new Date(foundTs + 7 * 24 * 60 * 60 * 1000).toISOString();

          setIsLoadingRelated(true);
          fetchNotifications({
            createNotificationqueryRequestBody: { from: relFrom, to: relTo, limit: 1000 },
          })
            .unwrap()
            .then((relResult) => {
              const related = (relResult.entries ?? [])
                .filter((e) => e.groupKey === found.groupKey && e.uuid !== found.uuid)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              setRelatedNotifications(related);
            })
            .catch(() => {})
            .finally(() => setIsLoadingRelated(false));

          // Alerts: use the notification's timestamp + 1 second as the window
          const alertFrom = found.timestamp;
          const alertTo = new Date(new Date(found.timestamp).getTime() + 1000).toISOString();

          setIsLoadingAlerts(true);
          fetchAlerts({
            createNotificationsqueryalertsRequestBody: { uuid, from: alertFrom, to: alertTo, limit: 1000 },
          })
            .unwrap()
            .then((alertResult) => setAlerts(alertResult.alerts ?? []))
            .catch(() => {})
            .finally(() => setIsLoadingAlerts(false));
        }
      })
      .catch((err) => {
        setFetchError(err?.message ?? t('alerting.notification-detail.error-unknown', 'Unknown error'));
        setNotification(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid, timestamp]);

  if (notification === undefined && !fetchError) {
    return <LoadingPlaceholder text={t('alerting.notification-detail.loading', 'Loading notification...')} />;
  }

  if (fetchError) {
    return (
      <Alert title={t('alerting.notification-detail.error-title', 'Error loading notification')} severity="error">
        {fetchError}
      </Alert>
    );
  }

  if (!notification) {
    return (
      <Alert
        title={t('alerting.notification-detail.uuid-not-found-title', 'Notification not found')}
        severity="warning"
      >
        <Trans i18nKey="alerting.notification-detail.uuid-not-found-body" values={{ uuid }}>
          No notification found with UUID: {{ uuid }}
        </Trans>
      </Alert>
    );
  }

  const failedRelated = relatedNotifications.filter((n) => n.outcome === 'error').length;

  return (
    <div className={styles.container}>
      <NotificationHeader
        notification={notification}
        relatedCount={relatedNotifications.length + 1}
        failedRelatedCount={failedRelated}
        onOpenRelated={() => setIsSidebarOpen(true)}
      />

      {notification.error && (
        <Alert title={t('alerting.notification-detail.error-title-banner', 'Delivery error')} severity="error">
          {notification.error}
        </Alert>
      )}

      <AlertsSection alerts={alerts} groupLabels={notification.groupLabels} isLoading={isLoadingAlerts} />

      {notification.groupLabels && Object.keys(notification.groupLabels).length > 0 && (
        <div className={styles.detailsBox}>
          <Text variant="h6">
            <Trans i18nKey="alerting.notification-detail.group-labels-heading">Group Labels</Trans>
          </Text>
          <AlertLabels labels={notification.groupLabels} size="sm" />
        </div>
      )}

      <DebugDetails notification={notification} isOpen={isDetailsOpen} onToggle={setIsDetailsOpen} />

      {isSidebarOpen && (
        <Drawer
          title={t('alerting.notification-detail.related-sidebar-title', 'Related Notifications')}
          subtitle={t(
            'alerting.notification-detail.related-sidebar-subtitle',
            'Notification attempts for the same alert group and route'
          )}
          onClose={() => setIsSidebarOpen(false)}
          size="sm"
        >
          <RelatedNotificationsSidebar
            currentNotification={notification}
            relatedNotifications={relatedNotifications}
            isLoading={isLoadingRelated}
          />
        </Drawer>
      )}
    </div>
  );
}

interface NotificationHeaderProps {
  notification: NotificationEntry;
  relatedCount: number;
  failedRelatedCount: number;
  onOpenRelated: () => void;
}

function NotificationHeader({
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
          <Tooltip content={dateTime(notification.timestamp).format('YYYY-MM-DD HH:mm:ss')}>
            <Text variant="bodySmall" color="secondary">
              {formatDistanceToNow(new Date(notification.timestamp))}
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
        href={`/alerting/notifications?search=${encodeURIComponent(notification.receiver)}`}
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

interface AlertsSectionProps {
  alerts: CreateNotificationsqueryalertsNotificationEntryAlert[];
  groupLabels: Record<string, string>;
  isLoading: boolean;
}

function AlertsSection({ alerts, groupLabels, isLoading }: AlertsSectionProps) {
  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.notification-detail.alerts-loading', 'Loading alerts...')} />;
  }

  if (alerts.length === 0) {
    return (
      <Text color="secondary">
        <Trans i18nKey="alerting.notification-detail.alerts-empty">No alerts found for this notification.</Trans>
      </Text>
    );
  }

  return (
    <>
      <AlertsList
        alerts={alerts.filter((a) => a.status === 'firing')}
        groupLabels={groupLabels}
        heading={t('alerting.notification-detail.firing-alerts', 'Firing Alerts')}
      />
      <AlertsList
        alerts={alerts.filter((a) => a.status !== 'firing')}
        groupLabels={groupLabels}
        heading={t('alerting.notification-detail.resolved-alerts', 'Resolved Alerts')}
      />
    </>
  );
}

function DebugDetails({
  notification,
  isOpen,
  onToggle,
}: {
  notification: NotificationEntry;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}) {
  const styles = useStyles2(getStyles);

  return (
    <Collapse
      label={t('alerting.notification-detail.debug-details-heading', 'Debug details')}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className={styles.detailsGrid}>
        <DetailRow label={t('alerting.notification-detail.field-uuid', 'UUID')} value={notification.uuid} />
        <DetailRow
          label={t('alerting.notification-detail.field-timestamp', 'Timestamp')}
          value={dateTime(notification.timestamp).format('YYYY-MM-DD HH:mm:ss')}
        />
        <DetailRow
          label={t('alerting.notification-detail.field-pipeline-time', 'Pipeline time')}
          value={dateTime(notification.pipelineTime).format('YYYY-MM-DD HH:mm:ss')}
        />
        <DetailRow
          label={t('alerting.notification-detail.field-integration-index', 'Integration index')}
          value={String(notification.integrationIndex)}
        />
        <DetailRow
          label={t('alerting.notification-detail.field-retry', 'Retry')}
          value={
            notification.retry
              ? t('alerting.notification-detail.yes', 'Yes')
              : t('alerting.notification-detail.no', 'No')
          }
        />
        <DetailRow
          label={t('alerting.notification-detail.field-group-key', 'Group key')}
          value={<code className={styles.groupKey}>{notification.groupKey}</code>}
        />
      </div>
    </Collapse>
  );
}

interface DetailRowProps {
  label: string;
  value: ReactNode;
}

function DetailRow({ label, value }: DetailRowProps) {
  const styles = useStyles2(getStyles);
  return (
    <>
      <div className={styles.detailLabel}>
        <Text color="secondary" variant="bodySmall">
          {label}
        </Text>
      </div>
      <div className={styles.detailValue}>{typeof value === 'string' ? <Text>{value}</Text> : value}</div>
    </>
  );
}

interface AlertsListProps {
  alerts: CreateNotificationsqueryalertsNotificationEntryAlert[];
  groupLabels: Record<string, string>;
  heading: string;
}

function AlertsList({ alerts, groupLabels, heading }: AlertsListProps) {
  const styles = useStyles2(getStyles);

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      <Text variant="h6">
        {heading} ({alerts.length})
      </Text>
      {alerts.map((alert, index) => {
        const ruleUid = alert.labels?.__alert_rule_uid__;
        const alertName = alert.labels?.alertname || 'Alert';
        const folderName = alert.labels?.grafana_folder || '';
        const linkText = folderName ? `${folderName} / ${alertName}` : alertName;
        const ruleLink = ruleUid ? `/alerting/grafana/${ruleUid}/view` : undefined;

        const filteredLabels = alert.labels
          ? Object.keys(alert.labels).reduce((acc: Record<string, string>, key: string) => {
              if (key !== 'grafana_folder' && !(key in groupLabels)) {
                acc[key] = alert.labels[key];
              }
              return acc;
            }, {})
          : {};

        const summary = alert.annotations?.summary;
        const description = alert.annotations?.description;
        const otherAnnotations = alert.annotations
          ? Object.keys(alert.annotations).reduce((acc: Record<string, string>, key: string) => {
              if (key !== 'summary' && key !== 'description') {
                acc[key] = alert.annotations[key];
              }
              return acc;
            }, {})
          : {};

        return (
          <div key={index} className={styles.alertDetail}>
            <Stack direction="column" gap={1}>
              <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
                {ruleLink ? (
                  <TextLink href={ruleLink} color="primary" inline={false}>
                    {linkText}
                  </TextLink>
                ) : (
                  <Text>{linkText}</Text>
                )}
                {alert.startsAt && (
                  <Tooltip content={dateTime(alert.startsAt).format('YYYY-MM-DD HH:mm:ss')}>
                    <Text variant="bodySmall" color="secondary">
                      {formatDistanceToNow(new Date(alert.startsAt))}
                    </Text>
                  </Tooltip>
                )}
              </Stack>
              {Object.keys(filteredLabels).length > 0 && (
                <Stack direction="row" gap={1} alignItems="center">
                  <Text variant="bodySmall" color="secondary">
                    <strong>
                      <Trans i18nKey="alerting.notifications-scene.labels">Labels:</Trans>
                    </strong>
                  </Text>
                  <AlertLabels labels={filteredLabels} size="sm" />
                </Stack>
              )}
              {Object.keys(otherAnnotations).length > 0 && (
                <Stack direction="row" gap={1} alignItems="center">
                  <Text variant="bodySmall" color="secondary">
                    <strong>
                      <Trans i18nKey="alerting.notifications-scene.annotations">Annotations:</Trans>
                    </strong>
                  </Text>
                  <AlertLabels labels={otherAnnotations} size="sm" />
                </Stack>
              )}
              {summary && (
                <Text variant="bodySmall" color="secondary">
                  <strong>
                    <Trans i18nKey="alerting.notifications-scene.summary">Summary:</Trans>
                  </strong>{' '}
                  {summary}
                </Text>
              )}
              {description && (
                <Text variant="bodySmall" color="secondary">
                  <strong>
                    <Trans i18nKey="alerting.notifications-scene.description">Description:</Trans>
                  </strong>{' '}
                  {description}
                </Text>
              )}
            </Stack>
          </div>
        );
      })}
    </Stack>
  );
}

interface NotificationStateProps {
  status: 'firing' | 'resolved';
}

function NotificationState({ status }: NotificationStateProps) {
  const isFiring = status === 'firing';
  const statusText = isFiring
    ? t('alerting.notifications-list.status-firing', 'Firing')
    : t('alerting.notifications-list.status-resolved', 'Resolved');
  const state = isFiring ? 'bad' : 'good';
  return <StateTag state={state}>{statusText}</StateTag>;
}

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

function RelatedNotificationsSidebar({
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
                {dateTime(batch.timestamp).format('YYYY-MM-DD HH:mm:ss')}
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
            {/* Individual deliveries within the batch */}
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

function formatDistanceToNow(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffS = Math.floor(Math.abs(diffMs) / 1000);
  const suffix = diffMs >= 0 ? ' ago' : ' from now';

  if (diffS < 60) {
    return `${diffS} second${diffS !== 1 ? 's' : ''}${suffix}`;
  }
  const diffM = Math.floor(diffS / 60);
  const remS = diffS % 60;
  if (diffM < 60) {
    if (remS === 0) {
      return `${diffM} minute${diffM !== 1 ? 's' : ''}${suffix}`;
    }
    return `${diffM} minute${diffM !== 1 ? 's' : ''} ${remS} second${remS !== 1 ? 's' : ''}${suffix}`;
  }
  const diffH = Math.floor(diffM / 60);
  const remM = diffM % 60;
  if (diffH < 24) {
    if (remM === 0) {
      return `${diffH} hour${diffH !== 1 ? 's' : ''}${suffix}`;
    }
    return `${diffH} hour${diffH !== 1 ? 's' : ''} ${remM} minute${remM !== 1 ? 's' : ''}${suffix}`;
  }
  const diffD = Math.floor(diffH / 24);
  const remH = diffH % 24;
  if (remH === 0) {
    return `${diffD} day${diffD !== 1 ? 's' : ''}${suffix}`;
  }
  return `${diffD} day${diffD !== 1 ? 's' : ''} ${remH} hour${remH !== 1 ? 's' : ''}${suffix}`;
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
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
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
  detailsBox: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  detailsGrid: css({
    display: 'grid',
    gridTemplateColumns: '180px 1fr',
    gap: `${theme.spacing(1)} ${theme.spacing(2)}`,
    alignItems: 'start',
  }),
  detailLabel: css({
    paddingTop: '2px',
  }),
  detailValue: css({
    wordBreak: 'break-all',
  }),
  groupKey: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    backgroundColor: theme.colors.background.canvas,
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.5)}`,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    wordBreak: 'break-all',
  }),
  alertDetail: css({
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
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
});

export default withPageErrorBoundary(NotificationDetailPage);
