import { css } from '@emotion/css';

import { type GrafanaTheme2, dateTimeFormatTimeAgo } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import type { Notification } from 'app/features/notifications/api/types';

interface Props {
  notification: Notification;
  onClose: () => void;
}

export function NotificationBellItem({ notification, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const { spec } = notification;
  const verb = spec.type === 'mention' ? 'mentioned you' : 'replied to your thread';

  const handleClick = () => {
    locationService.push(spec.source.deepLink);
    onClose();
  };

  return (
    <button type="button" className={styles.item} onClick={handleClick}>
      <span className={styles.actor}>{spec.actor.name}</span>
      <span className={styles.verb}>{` ${verb}`}</span>
      {spec.excerpt && <p className={styles.excerpt}>{spec.excerpt}</p>}
      <span className={styles.time}>{dateTimeFormatTimeAgo(spec.createdAt)}</span>
    </button>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    item: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1, 1.5),
      width: '100%',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    actor: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),
    verb: css({
      color: theme.colors.text.secondary,
    }),
    excerpt: css({
      margin: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '280px',
    }),
    time: css({
      color: theme.colors.text.disabled,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
