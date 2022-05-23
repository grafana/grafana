import { css, cx } from '@emotion/css';
import React, { useRef, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Checkbox, Icon, useStyles2 } from '@grafana/ui';
import { StoredNotificationItem } from 'app/core/components/AppNotifications/StoredNotificationItem';
import {
  clearAllNotifications,
  clearNotification,
  readAllNotifications,
  selectWarningsAndErrors,
  selectLastReadTimestamp,
} from 'app/core/reducers/appNotification';
import { useDispatch, useSelector } from 'app/types';

export function StoredNotifications() {
  const dispatch = useDispatch();
  const notifications = useSelector((state) => selectWarningsAndErrors(state.appNotifications));
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<string[]>([]);
  const lastReadTimestamp = useRef(useSelector((state) => selectLastReadTimestamp(state.appNotifications)));
  const styles = useStyles2(getStyles);

  useEffectOnce(() => {
    dispatch(readAllNotifications(Date.now()));
  });

  const clearSelectedNotifications = () => {
    selectedNotificationIds.forEach((id) => {
      dispatch(clearNotification(id));
    });
    setSelectedNotificationIds([]);
  };

  const clearAllNotifs = () => {
    dispatch(clearAllNotifications());
  };

  const handleCheckboxToggle = (id: string, isChecked: boolean) => {
    setSelectedNotificationIds((prevState) => {
      if (isChecked && !prevState.includes(id)) {
        return [...prevState, id];
      } else {
        return prevState.filter((notificationId) => notificationId !== id);
      }
    });
  };

  if (notifications.length === 0) {
    return (
      <div className={styles.noNotifsWrapper}>
        <Icon name="bell" size="xxl" />
        <span>Notifications you have received will appear here.</span>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      This page displays all past errors and warnings. Once dismissed, they cannot be retrieved.
      <div className={styles.topRow}>
        <Button
          variant="destructive"
          onClick={selectedNotificationIds.length === 0 ? clearAllNotifs : clearSelectedNotifications}
          className={styles.clearAll}
        >
          {selectedNotificationIds.length === 0 ? 'Clear all notifications' : 'Clear selected notifications'}
        </Button>
      </div>
      <ul className={styles.list}>
        {notifications.map((notif) => (
          <li key={notif.id} className={styles.listItem}>
            <Checkbox
              value={selectedNotificationIds.includes(notif.id)}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handleCheckboxToggle(notif.id, event.target.checked)
              }
            />
            <StoredNotificationItem
              className={cx(styles.notification, { [styles.newItem]: notif.timestamp > lastReadTimestamp.current })}
              severity={notif.severity}
              title={notif.title}
              timestamp={notif.timestamp}
              traceId={notif.traceId}
            >
              <span>{notif.text}</span>
            </StoredNotificationItem>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    topRow: css({
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    smallText: css({
      fontSize: theme.typography.pxToRem(10),
      color: theme.colors.text.secondary,
    }),
    side: css({
      display: 'flex',
      flexDirection: 'column',
      padding: '3px 6px',
      paddingTop: theme.spacing(1),
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      flexShrink: 0,
    }),
    list: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    listItem: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(2),
      listStyle: 'none',
      position: 'relative',
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
    noNotifsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    notification: css({
      flex: 1,
      position: 'relative',
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    clearAll: css({
      alignSelf: 'flex-end',
    }),
  };
}
