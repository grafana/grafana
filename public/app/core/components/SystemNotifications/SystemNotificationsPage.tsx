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
  selectWarningsAndErrors,
  selectLastReadTimestamp,
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

const pageNav: NavModelItem = {
  icon: 'user',
  id: 'system-notifications',
  text: 'System notifications',
  // subTitle: '',
  breadcrumbs: [{ title: 'System notifications', url: 'system-notifications' }],
};

export const SystemNotificationsPage = () => {
  //({ className }: SystemNotificationsProps) => {
  // const notifications = useSelector((state) => selectWarningsAndErrors(state.appNotifications));
  const dispatch = useDispatch();
  const notifications = useSelector((state) => selectWarningsAndErrors(state.appNotifications));
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
          {userAccountNotifications.map((notif) => {
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
        <div className={styles.notificationGroup}>
          <h3>Product updates</h3>
          <hr />
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
        <div className={styles.notificationGroup}>
          <h3>Permissions and Access</h3>
          <hr />
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

        <div className={styles.notificationGroup}>
          <h3>Product Announcements</h3>
          <hr />
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
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    notificationGroup: css({
      marginTop: '32px',
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
const userAccountNotifications = [
  {
    id: '2bc766e7-5f6e-4774-a648-a7bfe51bed63',
    severity: 'warning',
    icon: 'exclamation-triangle',
    title: 'Invalid username or password',
    text: 'Oh I am an error',
    traceId: '12345',
    timestamp: 1670023855624,
    type: 'systemMessage',
    showing: false,
  },
  {
    id: '2wc766e7-5f6e-4774-a648-a7bfe51bed6w',
    severity: 'error',
    icon: 'exclamation-triangle',
    title: 'Terribly informative error message',
    text: 'I am a really big error',
    traceId: '54321',
    timestamp: 1670023855731,
    type: 'systemMessage',
    showing: false,
  },
];

const productUpdateNotifications = [
  {
    id: '2bc766e7-5f6e-4774-a648-a7bfe51bed63',
    severity: 'info',
    icon: 'public/plugins/grafana-synthetic-monitoring-app/img/logo.svg',
    title: 'Synthetic Monitoring',
    text: 'Update Synthetics Monitoring to version 3.01',
    traceId: '123455',
    timestamp: 1670023812345,
    type: 'update',
    showing: true,
  },
  {
    id: '2wc766e7-5f6e-4774-a648-a7bfe51bed6w',
    severity: 'error',
    icon: 'public/plugins/grafana-synthetic-monitoring-app/img/logo.svg',
    title: 'Kubernetes',
    text: 'The current version of Kubernetes is 2.32; your version is 1.30',
    traceId: '54321',
    timestamp: 1670023855731,
    type: 'update',
    showing: false,
  },
];

const permissionsAndAccessNotifications = [
  {
    id: '2bc766e7-5f6e-4774-a648-a7bfe51bed63',
    severity: 'warning',
    icon: 'exclamation-triangle',
    title: 'Integrations and Connections',
    text: '5 non-admin users are requesting access to the Synthtics Monitoring probes in Tokyo',
    traceId: '123455',
    timestamp: 1670023812345,
    type: 'access',
    showing: true,
  },
  {
    id: '2wc766e7-5f6e-4774-a648-a7bfe51bed6w',
    severity: 'success',
    icon: 'exclamation-triangle',
    title: 'Synthetic Monitoring',
    text: 'Admin access removed for very-rude-123@gmail.com',
    traceId: '54321',
    timestamp: 1670023855789,
    type: 'access',
    showing: false,
  },
  {
    id: '2wc766e7-5f6e-4774-a648-a7bfe51bed6w',
    severity: 'error',
    icon: 'exclamation-triangle',
    title: 'Integrations',
    text: 'Permissions changed to read-only for very-rude-123@gmail.com',
    traceId: '54321',
    timestamp: 1670023855789,
    type: 'permissions',
    showing: false,
  },
];

const productAnnouncementsNotifications = [
  {
    id: '2bc766e7-5f6e-4774-a648-a7bfe51bed63',
    severity: 'success',
    icon: 'exclamation-triangle',
    title: '',
    text: 'Announcing Grafana Faro',
    traceId: '123457',
    timestamp: 1009023812345,
    type: 'productAnnouncement',
    showing: true,
  },
];
