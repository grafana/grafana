import { css } from '@emotion/css';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';

import { GrafanaTheme2, AppNotificationType } from '@grafana/data';
import { useStyles2, Tag } from '@grafana/ui';
import { selectAll } from 'app/core/reducers/appNotification';
import { useSelector, tagColorMap } from 'app/types';

export function Notification() {
  const styles = useStyles2(getStyles);
  const notifications = useSelector((state) => selectAll(state.appNotifications));

  return (
    <div className={styles.layout} onClick={(e) => e.stopPropagation()}>
      <h4>Notifications</h4>
      <ul>
        {notifications.map((notification) => {
          const tagType = notification.type ?? AppNotificationType.SystemMessage;

          return (
            <li key={`top-${notification.id}`} className={styles.notificationItem}>
              <a href="/system-notifications">
                <div className={styles.titleWrapper}>
                  <Tag name={tagType} colorIndex={tagColorMap[tagType]} />
                  <p className={styles.title}>{notification.title}</p>
                </div>
                <span className={styles.date}>
                  {notification.timestamp && formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                </span>
              </a>
            </li>
          );
        })}
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
  titleWrapper: css({
    display: 'flex',
  }),
  title: css({
    marginBottom: `${theme.spacing(0.5)}`,
    marginLeft: `${theme.spacing(1.5)}`,
  }),
  date: css({
    color: `${theme.colors.text.secondary}`,
    fontSize: `${theme.typography.size.sm}`,
  }),
});
