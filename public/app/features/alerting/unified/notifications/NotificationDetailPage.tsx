import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { AlertLabels } from '@grafana/alerting/unstable';
import {
  type CreateNotificationqueryNotificationEntry,
  type CreateNotificationsqueryalertsNotificationEntryAlert,
  useCreateNotificationqueryMutation,
  useCreateNotificationsqueryalertsMutation,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { NavModelItem } from '@grafana/data/types';
import { Trans, t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder, TabContent } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { type PageInfoItem } from 'app/core/components/Page/types';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { NotificationActionsMenu } from './NotificationDetailActions';
import { AlertsListSection, OverviewSection } from './NotificationDetailAlerts';
import { NotificationHeader } from './NotificationDetailHeader';
import { NotificationDetailSidebar } from './NotificationDetailSidebar';
import { RelatedNotificationsSidebar } from './RelatedNotificationsSidebar';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

enum ActiveTab {
  Overview = 'overview',
  Alerts = 'alerts',
  Related = 'related',
}

function isValidTab(tab: unknown): tab is ActiveTab {
  return tab === ActiveTab.Overview || tab === ActiveTab.Alerts || tab === ActiveTab.Related;
}

function useActiveTab(): [ActiveTab, (tab: ActiveTab) => void] {
  const [queryParams, setQueryParams] = useQueryParams();
  const tabFromQuery = queryParams.tab;

  const activeTab = isValidTab(tabFromQuery) ? tabFromQuery : ActiveTab.Overview;

  const setActiveTab = (tab: ActiveTab) => {
    setQueryParams({ tab });
  };

  return [activeTab, setActiveTab];
}

function pickHeadingLabel(groupLabels: Record<string, string> | undefined): { short: string; full: string } {
  if (!groupLabels || Object.keys(groupLabels).length === 0) {
    return { short: 'Notification', full: 'Notification' };
  }

  const name = groupLabels.alertname || groupLabels.service_name || Object.values(groupLabels)[0];
  const extraValues = Object.entries(groupLabels)
    .filter(([key]) => key !== 'alertname' && key !== 'service_name')
    .map(([, value]) => value);

  if (extraValues.length > 0) {
    return { short: name, full: `${name} (${extraValues.join(', ')})` };
  }

  return { short: name, full: name };
}

interface HeaderData {
  notification: NotificationEntry;
  relatedCount: number;
  failedRelatedCount: number;
}

function NotificationDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const [queryParams] = useQueryParams();
  const timestamp = typeof queryParams.ts === 'string' ? queryParams.ts : undefined;
  const defaultTitle = t('alerting.notification-detail.page-title', 'View');
  const [pageTitle, setPageTitle] = useState(defaultTitle);
  const [displayTitle, setDisplayTitle] = useState(defaultTitle);
  const [notification, setNotification] = useState<CreateNotificationqueryNotificationEntry | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [relatedCount, setRelatedCount] = useState(0);
  const [activeTab, setActiveTab] = useActiveTab();
  const [headerData, setHeaderData] = useState<HeaderData | null>(null);

  const pageNav: NavModelItem = {
    text: pageTitle,
    children: [
      {
        text: t('alerting.notification-detail.tab-overview', 'Overview'),
        active: activeTab === ActiveTab.Overview,
        onClick: () => setActiveTab(ActiveTab.Overview),
      },
      {
        text: t('alerting.notification-detail.tab-alerts', 'Alerts'),
        active: activeTab === ActiveTab.Alerts,
        onClick: () => setActiveTab(ActiveTab.Alerts),
        tabCounter: alertCount,
      },
      {
        text: t('alerting.notification-detail.tab-related', 'Related'),
        active: activeTab === ActiveTab.Related,
        onClick: () => setActiveTab(ActiveTab.Related),
        tabCounter: relatedCount,
      },
    ],
  };

  const info: PageInfoItem[] = [];
  if (notification?.groupLabels && Object.keys(notification.groupLabels).length > 0) {
    info.push({
      label: t('alerting.notification-detail.info-group-labels', 'Group labels'),
      value: <AlertLabels labels={notification.groupLabels} size="sm" />,
    });
  }

  const subTitle = headerData ? <NotificationHeader notification={headerData.notification} /> : undefined;

  return (
    <AlertingPageWrapper
      navId="alerts-history"
      pageNav={pageNav}
      isLoading={false}
      renderTitle={() => <h1>{displayTitle}</h1>}
      info={info.length > 0 ? info : undefined}
      actions={notification ? <NotificationActionsMenu notification={notification} /> : undefined}
      subTitle={subTitle}
    >
      {uuid ? (
        <NotificationDetail
          uuid={uuid}
          timestamp={timestamp}
          activeTab={activeTab}
          onTitleChange={(short, full) => {
            setDisplayTitle(short);
            setPageTitle(full);
          }}
          onNotificationLoaded={setNotification}
          onAlertCountChange={setAlertCount}
          onRelatedCountChange={setRelatedCount}
          onHeaderDataChange={setHeaderData}
        />
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
  activeTab: ActiveTab;
  onTitleChange: (shortTitle: string, fullTitle: string) => void;
  onNotificationLoaded: (notification: CreateNotificationqueryNotificationEntry) => void;
  onAlertCountChange: (count: number) => void;
  onRelatedCountChange: (count: number) => void;
  onHeaderDataChange: (data: HeaderData | null) => void;
}

function NotificationDetail({
  uuid,
  timestamp,
  activeTab,
  onTitleChange,
  onNotificationLoaded,
  onAlertCountChange,
  onRelatedCountChange,
  onHeaderDataChange,
}: NotificationDetailProps) {
  const styles = useStyles2(getStyles);
  const [notification, setNotification] = useState<NotificationEntry | null | undefined>(undefined);
  const [relatedNotifications, setRelatedNotifications] = useState<NotificationEntry[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<CreateNotificationsqueryalertsNotificationEntryAlert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);

  const [fetchNotifications] = useCreateNotificationqueryMutation();
  const [fetchAlerts] = useCreateNotificationsqueryalertsMutation();

  // Keep header data in sync
  useEffect(() => {
    if (notification) {
      const failedRelated = relatedNotifications.filter((n) => n.outcome === 'error').length;
      onHeaderDataChange({
        notification,
        relatedCount: relatedNotifications.length + 1,
        failedRelatedCount: failedRelated,
      });
      onRelatedCountChange(relatedNotifications.length);
    } else {
      onHeaderDataChange(null);
    }
  }, [notification, relatedNotifications, onHeaderDataChange, onRelatedCountChange]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // If a timestamp is provided, query a 1-second window around it.
      // Otherwise fall back to a 90-day window.
      let from: string;
      let to: string;
      if (timestamp) {
        const ts = Number(timestamp);
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

        const { short, full } = pickHeadingLabel(found.groupLabels);
        onTitleChange(short, full);
        onNotificationLoaded(found);

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
          const loadedAlerts = alertResult.alerts ?? [];
          setAlerts(loadedAlerts);
          onAlertCountChange(loadedAlerts.length);
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

  return (
    <div className={styles.container}>
      {notification.error && (
        <Alert title={t('alerting.notification-detail.error-title-banner', 'Delivery error')} severity="error">
          {notification.error}
        </Alert>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <TabContent>
            {activeTab === ActiveTab.Overview && (
              <OverviewSection alerts={alerts} groupLabels={notification.groupLabels} isLoading={isLoadingAlerts} />
            )}
            {activeTab === ActiveTab.Alerts && (
              <AlertsListSection alerts={alerts} groupLabels={notification.groupLabels} isLoading={isLoadingAlerts} />
            )}
            {activeTab === ActiveTab.Related && (
              <RelatedNotificationsSidebar
                currentNotification={notification}
                relatedNotifications={relatedNotifications}
                isLoading={isLoadingRelated}
              />
            )}
          </TabContent>
        </div>

        <aside className={styles.sidebar}>
          <NotificationDetailSidebar notification={notification} />
        </aside>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  layout: css({
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: theme.spacing(3),
    alignItems: 'start',

    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr',
    },
  }),
  main: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  sidebar: css({
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    paddingLeft: theme.spacing(3),

    [theme.breakpoints.down('lg')]: {
      borderLeft: 'none',
      paddingLeft: 0,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      paddingTop: theme.spacing(3),
    },
  }),
});

export default withPageErrorBoundary(NotificationDetailPage);
