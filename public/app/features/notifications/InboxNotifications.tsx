import { css } from '@emotion/css';

import { type GrafanaTheme2, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, EmptyState, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { useDeleteNotificationMutation, useListNotificationsQuery } from './api/notificationsApi';
import { useNotificationsLive } from './hooks/useNotificationsLive';

export function InboxNotifications() {
  const orgID = contextSrv.user.orgId;
  const userUID = contextSrv.user.uid ?? '';
  const styles = useStyles2(getStyles);

  useNotificationsLive(orgID, userUID);

  const { data, isLoading } = useListNotificationsQuery({});
  const [deleteNotification] = useDeleteNotificationMutation();

  if (isLoading) {
    return <LoadingPlaceholder text="Loading notifications..." />;
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState variant="completed" message="No notifications">
        <Trans i18nKey="notifications.inbox.empty">You have no notifications</Trans>
      </EmptyState>
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((notification) => {
        const { spec } = notification;
        const verb = spec.type === 'mention' ? 'mentioned you' : 'replied to your thread';
        return (
          <li key={notification.metadata.name} className={styles.item}>
            <div className={styles.content}>
              <span className={styles.actor}>{spec.actor.name}</span>
              <span className={styles.verb}>{` ${verb}`}</span>
              {spec.excerpt && <p className={styles.excerpt}>{spec.excerpt}</p>}
              <span className={styles.time}>{dateTimeFormatTimeAgo(spec.createdAt)}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="trash-alt"
              aria-label="Delete notification"
              onClick={() => deleteNotification({ name: notification.metadata.name })}
            />
          </li>
        );
      })}
    </ul>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      listStyle: 'none',
      padding: 0,
    }),
    item: css({
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
      padding: theme.spacing(1.5),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      flex: 1,
    }),
    actor: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
    verb: css({
      color: theme.colors.text.secondary,
    }),
    excerpt: css({
      margin: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    time: css({
      color: theme.colors.text.disabled,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
