import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { AlertLabels } from '@grafana/alerting/unstable';
import {
  CreateNotificationqueryNotificationEntry,
  CreateNotificationsqueryalertsNotificationEntryAlert,
  useCreateNotificationqueryMutation,
  useCreateNotificationsqueryalertsMutation,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Drawer, LoadingPlaceholder, Text, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { AlertsSection } from './NotificationDetailAlerts';
import { DebugDetails } from './NotificationDetailDebug';
import { NotificationHeader } from './NotificationDetailHeader';
import { RelatedNotificationsSidebar } from './RelatedNotificationsSidebar';

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
    <AlertingPageWrapper navId="alerts-history" pageNav={pageNav} isLoading={false}>
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
    let cancelled = false;

    async function load() {
      // If a timestamp is provided, query a 1-second window around it.
      // Otherwise fall back to a 90-day window.
      let from: string;
      let to: string;
      if (timestamp) {
        const ts = new Date(timestamp).getTime();
        from = new Date(ts - 1000).toISOString();
        to = new Date(ts + 1000).toISOString();
      } else {
        from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        to = new Date().toISOString();
      }

      try {
        const result = await fetchNotifications({
          createNotificationqueryRequestBody: { from, to, limit: 1000 },
        }).unwrap();

        const found = (result.entries ?? []).find((e) => e.uuid === uuid) ?? null;
        if (cancelled) {
          return;
        }

        setNotification(found);
        if (!found) {
          return;
        }

        onTitleChange(pickHeadingLabel(found.groupLabels));

        const foundTs = new Date(found.timestamp).getTime();

        const relatedPromise = fetchRelatedNotifications(found, foundTs);
        const alertsPromise = fetchNotificationAlerts(found);
        await Promise.all([relatedPromise, alertsPromise]);
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : t('alerting.notification-detail.error-unknown', 'Unknown error');
          setFetchError(message);
          setNotification(null);
        }
      }
    }

    async function fetchRelatedNotifications(found: NotificationEntry, foundTs: number) {
      const relFrom = new Date(foundTs - 7 * 24 * 60 * 60 * 1000).toISOString();
      const relTo = new Date(foundTs + 7 * 24 * 60 * 60 * 1000).toISOString();

      setIsLoadingRelated(true);
      try {
        const relResult = await fetchNotifications({
          createNotificationqueryRequestBody: { from: relFrom, to: relTo, limit: 1000 },
        }).unwrap();

        if (!cancelled) {
          const related = (relResult.entries ?? [])
            .filter((e) => e.groupKey === found.groupKey && e.uuid !== found.uuid)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setRelatedNotifications(related);
        }
      } catch {
        // Related notifications are non-critical; silently ignore failures
      } finally {
        if (!cancelled) {
          setIsLoadingRelated(false);
        }
      }
    }

    async function fetchNotificationAlerts(found: NotificationEntry) {
      const alertFrom = found.timestamp;
      const alertTo = new Date(new Date(found.timestamp).getTime() + 1000).toISOString();

      setIsLoadingAlerts(true);
      try {
        const alertResult = await fetchAlerts({
          createNotificationsqueryalertsRequestBody: { uuid, from: alertFrom, to: alertTo, limit: 1000 },
        }).unwrap();

        if (!cancelled) {
          setAlerts(alertResult.alerts ?? []);
        }
      } catch {
        // Alert details are non-critical; silently ignore failures
      } finally {
        if (!cancelled) {
          setIsLoadingAlerts(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
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

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
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
});

export default withPageErrorBoundary(NotificationDetailPage);
