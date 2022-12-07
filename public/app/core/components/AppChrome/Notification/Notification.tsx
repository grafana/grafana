import { css } from '@emotion/css';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { selectAll } from 'app/core/reducers/appNotification';
import { useSelector } from 'app/types';

export function Notification() {
  const styles = useStyles2(getStyles);
  const notifications = useSelector((state) => selectAll(state.appNotifications));

  return (
    <div className={styles.layout} onClick={(e) => e.stopPropagation()}>
      <h4>Notifications</h4>
      <ul>
        {notifications.map((notification) => (
          <li key={notification.id} className={styles.notificationItem}>
            <a href="/system-notifications">
              <p className={styles.title}>{notification.title}</p>
              <span className={styles.date}>
                {notification.timestamp && formatDistanceToNow(notification.timestamp, { addSuffix: true })}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  layout: css({
    background: `${theme.colors.background.secondary}`,
    boxShadow: `${theme.shadows.z3}`,
    display: `inline-block`,
    borderRadius: `${theme.shape.borderRadius()}`,
    padding: `${theme.spacing(2)}`,
    width: '400px',
    maxHeight: '580px',
    overflow: 'scroll',
    h4: {
      paddingBottom: `${theme.spacing(3)}`,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
    ul: {
      listStyle: 'none',
    },
  }),
  notificationItem: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    padding: `${theme.spacing(1.5, 0)}`,
  }),
  title: css({
    marginBottom: `${theme.spacing(0.5)}`,
  }),
  date: css({
    color: `${theme.colors.text.secondary}`,
    fontSize: `${theme.typography.size.sm}`,
  }),
});
