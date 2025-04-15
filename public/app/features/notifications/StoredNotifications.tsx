import { css, cx } from '@emotion/css';
import { useRef, useState } from 'react';
import * as React from 'react';
import { useEffectOnce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Checkbox, EmptyState, useStyles2 } from '@grafana/ui';
import { StoredNotificationItem } from 'app/core/components/AppNotifications/StoredNotificationItem';
import { Trans, t } from 'app/core/internationalization';
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

  if (notifications.length === 0) {
    return (
      <EmptyState variant="completed" message={t('notifications.empty-state.title', "You're all caught up!")}>
        <Trans i18nKey="notifications.empty-state.description">Notifications you have received will appear here</Trans>
      </EmptyState>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Alert
        severity="info"
        title={t(
          'notifications.stored-notifications.title-alert',
          'This page displays past errors and warnings. Once dismissed, they cannot be retrieved.'
        )}
      />
      <div className={styles.topRow}>
        <Checkbox
          value={allNotificationsSelected}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleAllCheckboxToggle(event.target.checked)}
        />
        <Button disabled={selectedNotificationIds.length === 0} onClick={clearSelectedNotifications}>
          <Trans i18nKey="notifications.stored-notifications.dismiss-notifications">Dismiss notifications</Trans>
        </Button>
      </div>
      <ul className={styles.list}>
        {notifications.map((notif) => (
          <li key={notif.id} className={styles.listItem}>
            <StoredNotificationItem
              className={cx({ [styles.newItem]: notif.timestamp > lastReadTimestamp.current })}
              isSelected={selectedNotificationIds.includes(notif.id)}
              onClick={() => handleCheckboxToggle(notif.id)}
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
      gap: theme.spacing(2),
    }),
    list: css({
      display: 'flex',
      flexDirection: 'column',
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
        borderRadius: theme.shape.radius.default,
      },
    }),
    noNotifsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
  };
}
