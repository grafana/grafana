import { css, cx } from '@emotion/css';
import React, { ReactNode, useRef, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { AppNotificationType, NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Checkbox, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import {
  clearAllNotifications,
  clearNotification,
  readAllNotifications,
  // selectWarningsAndErrors,
  selectLastReadTimestamp,
  selectAll,
} from 'app/core/reducers/appNotification';
import { useDispatch, useSelector } from 'app/types';

import SystemNotificationsItem from './SystemNotificationsItem';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface SystemNotificationsProps {
  children?: ReactNode;
  className?: string;
  isSelected: boolean;
  onClick: () => void;
  severity?: AlertVariant;
  title: string;
  description?: string;
  icon?: string;
  type?: AppNotificationType;
  timestamp?: number;
  traceId?: string;
}

interface Notification {
  id: string;
  severity: AlertVariant;
  icon: string;
  title: string;
  text: string;
  traceId: string;
  timestamp: number;
  type?: AppNotificationType;
  showing: boolean;
}

const pageNav: NavModelItem = {
  icon: 'bell',
  id: 'system-notifications',
  text: 'System notifications',
  // subTitle: '',
  // breadcrumbs: [{ title: 'System notifications', url: 'system-notifications' }],
};

export const SystemNotificationsPage = () => {
  const dispatch = useDispatch();
  const notifications = useSelector((state) => selectAll(state.appNotifications));
  const updatedNotifications = notifications.map((i) => i.type ?? { ...i, type: AppNotificationType.SystemMessage });
  // const notifications = useSelector((state) => selectWarningsAndErrors(state.appNotifications));
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<string[]>([]);
  const allNotificationsSelected = notifications.every((notification) =>
    selectedNotificationIds.includes(notification.id)
  );
  const lastReadTimestamp = useRef(useSelector((state) => selectLastReadTimestamp(state.appNotifications)));
  const styles = useStyles2(getStyles);

  useEffectOnce(() => {
    dispatch(readAllNotifications(Date.now()));
  });

  const clearSelectedNotifications = () => {
    if (allNotificationsSelected) {
      dispatch(clearAllNotifications());
    } else {
      selectedNotificationIds.forEach((id) => {
        dispatch(clearNotification(id));
      });
    }
    setSelectedNotificationIds([]);
  };

  const handleAllCheckboxToggle = (isChecked: boolean) => {
    setSelectedNotificationIds(isChecked ? notifications.map((n) => n.id) : []);
  };

  const handleCheckboxToggle = (id: string) => {
    setSelectedNotificationIds((prevState) => {
      if (!prevState.includes(id)) {
        return [...prevState, id];
      } else {
        return prevState.filter((notificationId) => notificationId !== id);
      }
    });
  };

  return (
    <Page navId="system-notifications" pageNav={pageNav}>
      <Page.Contents>
        <Alert
          severity="info"
          title="This page displays past errors and warnings. Once dismissed, they cannot be retrieved."
        />
        <div className={styles.topRow}>
          <Checkbox
            value={allNotificationsSelected}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleAllCheckboxToggle(event.target.checked)}
          />
          <Button disabled={selectedNotificationIds.length === 0} onClick={clearSelectedNotifications}>
            Dismiss notifications
          </Button>
        </div>
        <div className={styles.notificationGroup}>
          <h3>User account</h3>
          <hr />
          <div className={styles.notificationGroupListItems}>
            {updatedNotifications.map((notif) => {
              return (
                <li key={notif.id} className={styles.listItem}>
                  <SystemNotificationsItem
                    className={cx({ [styles.newItem]: notif.timestamp > lastReadTimestamp.current })}
                    isSelected={selectedNotificationIds.includes(notif.id)}
                    onClick={() => handleCheckboxToggle(notif.id)}
                    severity={notif.severity}
                    title={notif.title}
                    description={notif.text}
                    icon={notif.icon}
                    type={notif.type}
                    traceId={notif.traceId}
                    timestamp={notif.timestamp}
                  />
                </li>
              );
            })}
          </div>
        </div>
        <div className={styles.notificationGroup}>
          <h3>Product updates</h3>
          <hr />
          <div className={styles.notificationGroupListItems}>
            {productUpdateNotifications.map((notif) => {
              return (
                <li key={notif.id} className={styles.listItem}>
                  <SystemNotificationsItem
                    className={cx({ [styles.newItem]: notif.timestamp > lastReadTimestamp.current })}
                    isSelected={selectedNotificationIds.includes(notif.id)}
                    onClick={() => handleCheckboxToggle(notif.id)}
                    severity={notif.severity}
                    title={notif.title}
                    description={notif.text}
                    icon={notif.icon}
                    type={notif.type}
                    traceId={notif.traceId}
                    timestamp={notif.timestamp}
                  />
                </li>
              );
            })}
          </div>
        </div>
        <div className={styles.notificationGroup}>
          <h3>Permissions and Access</h3>
          <hr />
          <div className={styles.notificationGroupListItems}>
            {permissionsAndAccessNotifications.map((notif) => {
              return (
                <li key={notif.id} className={styles.listItem}>
                  <SystemNotificationsItem
                    className={cx({ [styles.newItem]: notif.timestamp > lastReadTimestamp.current })}
                    isSelected={selectedNotificationIds.includes(notif.id)}
                    onClick={() => handleCheckboxToggle(notif.id)}
                    severity={notif.severity}
                    title={notif.title}
                    description={notif.text}
                    icon={notif.icon}
                    type={notif.type}
                    traceId={notif.traceId}
                    timestamp={notif.timestamp}
                  />
                </li>
              );
            })}
          </div>
        </div>

        <div className={styles.notificationGroup}>
          <h3>Product Announcements</h3>
          <hr />
          <div className={styles.notificationGroupListItems}>
            {productAnnouncementsNotifications.map((notif) => {
              return (
                <li key={notif.id} className={styles.listItem}>
                  <SystemNotificationsItem
                    className={cx({ [styles.newItem]: notif.timestamp > lastReadTimestamp.current })}
                    isSelected={selectedNotificationIds.includes(notif.id)}
                    onClick={() => handleCheckboxToggle(notif.id)}
                    severity={notif.severity}
                    title={notif.title}
                    description={notif.text}
                    icon={notif.icon}
                    type={notif.type}
                    traceId={notif.traceId}
                    timestamp={notif.timestamp}
                  />
                </li>
              );
            })}
          </div>
        </div>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    notificationGroup: css({
      marginTop: '32px',
    }),
    notificationGroupListItems: css({
      maxHeight: '260px',
      overflow: 'scroll',
    }),
    topRow: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(2),
    }),
    trace: css({
      alignItems: 'flex-end',
      alignSelf: 'flex-end',
      color: theme.colors.text.secondary,
      display: 'flex',
      flexDirection: 'column',
      fontSize: theme.typography.pxToRem(10),
      justifySelf: 'flex-end',
    }),
    newItem: css({
      '&::before': {
        content: '""',
        height: '100%',
        position: 'absolute',
        left: '-7px',
        top: 0,
        background: theme.colors.gradients.brandVertical,
        width: theme.spacing(0.5),
        borderRadius: theme.shape.borderRadius(1),
      },
    }),
    listItem: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(2),
      listStyle: 'none',
      position: 'relative',
    }),
  };
};

export default SystemNotificationsPage;

// DUMMY DATA
const productUpdateNotifications: Notification[] = [
  {
    id: '2bc766e7-5f6e-4774-a648-a7bfe51bed63',
    severity: 'info',
    icon: 'public/img/plugins/grafana-synthetic-monitoring-app.svg',
    title: 'Synthetic Monitoring',
    text: 'Update Synthetics Monitoring to version 3.01',
    traceId: '123455',
    timestamp: 1670023812345,
    type: AppNotificationType.Update,
    showing: true,
  },
  {
    id: '2wc766e7-5f6e-4774-a648-a7bfe51bed6w',
    severity: 'error',
    icon: 'public/img/plugins/kubernetes.png',
    title: 'Kubernetes',
    text: 'The current version of Kubernetes is 2.32; your version is 1.30',
    traceId: '54321',
    timestamp: 1670023855731,
    type: AppNotificationType.Update,
    showing: false,
  },
];

const permissionsAndAccessNotifications: Notification[] = [
  {
    id: '2bc766e7-5f6e-4774-a648-a7bfe51bed63',
    severity: 'warning',
    icon: 'public/img/plugins/grafana-synthetic-monitoring-app.svg',
    title: 'Synthetic Monitoring',
    text: '5 non-admin users are requesting access to the Synthtics Monitoring probes in Tokyo',
    traceId: '123455',
    timestamp: 1670023812345,
    type: AppNotificationType.Access,
    showing: true,
  },
  {
    id: '2wc766e7-5f6e-4774-a648-a7bfe51bed6w',
    severity: 'success',
    icon: 'public/img/plugins/grafana-synthetic-monitoring-app.svg',
    title: 'Synthetic Monitoring',
    text: 'Admin access removed for very-rude-123@gmail.com',
    traceId: '54321',
    timestamp: 1670023855789,
    type: AppNotificationType.Access,
    showing: false,
  },
  {
    id: '2wc766e7-5f6e-4774-a648-a7bfe51bed6w',
    severity: 'error',
    icon: 'public/img/plugins/grafana-easystart-app.svg',
    title: 'Integrations and Connections',
    text: 'Permissions changed to read-only for very-rude-123@gmail.com',
    traceId: '54321',
    timestamp: 1670023855789,
    type: AppNotificationType.Permissions,
    showing: false,
  },
];

const productAnnouncementsNotifications: Notification[] = [
  {
    id: '2bc766e7-5f6e-4774-a648-a7bfe51bed63',
    severity: 'success',
    icon: 'exclamation-triangle',
    title: '',
    text: 'Announcing Grafana Faro',
    traceId: '123457',
    timestamp: 1009023812345,
    type: AppNotificationType.ProductAnnouncement,
    showing: true,
  },
];
