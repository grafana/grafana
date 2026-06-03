import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardCommentNotifications } from '@grafana/runtime/internal';
import { Dropdown, TextLink, ToolbarButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { useListNotificationsQuery } from 'app/features/notifications/api/notificationsApi';
import { useNotificationsLive } from 'app/features/notifications/hooks/useNotificationsLive';

import { NotificationBellItem } from './NotificationBellItem';

function BellMenu({ onClose }: { onClose: () => void }) {
  const styles = useStyles2(getMenuStyles);
  const { data } = useListNotificationsQuery({ limit: 10 });
  const items = data?.items ?? [];

  return (
    <div className={styles.menu}>
      {items.length === 0 ? (
        <p className={styles.empty}>{t('notifications.bell.empty', 'No notifications')}</p>
      ) : (
        items.map((notification) => (
          <NotificationBellItem key={notification.metadata.name} notification={notification} onClose={onClose} />
        ))
      )}
      <div className={styles.footer}>
        <TextLink href="/profile/notifications">
          {t('notifications.bell.open-inbox', 'Open inbox')}
        </TextLink>
      </div>
    </div>
  );
}

function getMenuStyles(theme: GrafanaTheme2) {
  return {
    menu: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      minWidth: '320px',
      maxWidth: '360px',
    }),
    empty: css({
      padding: theme.spacing(2),
      color: theme.colors.text.secondary,
      margin: 0,
    }),
    footer: css({
      padding: theme.spacing(1, 1.5),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}

export function NotificationBell() {
  const flagEnabled = useFlagGrafanaDashboardCommentNotifications();
  const styles = useStyles2(getBellStyles);
  const [isOpen, setIsOpen] = useState(false);

  const orgID = contextSrv.user.orgId;
  const userUID = contextSrv.user.uid ?? '';

  useNotificationsLive(orgID, userUID);

  const { data } = useListNotificationsQuery({ limit: 10 });
  const hasNotifications = (data?.items.length ?? 0) > 0;

  if (!flagEnabled || !contextSrv.isSignedIn) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Dropdown
        overlay={() => <BellMenu onClose={() => setIsOpen(false)} />}
        placement="bottom-end"
        onVisibleChange={setIsOpen}
      >
        <ToolbarButton
          iconOnly
          icon="bell"
          isOpen={isOpen}
          aria-label={t('notifications.bell.aria-label', 'Notifications')}
          tooltip={t('notifications.bell.tooltip', 'Notifications')}
        />
      </Dropdown>
      {hasNotifications && <span className={styles.dot} aria-hidden />}
    </div>
  );
}

function getBellStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      position: 'relative',
      display: 'inline-flex',
    }),
    dot: css({
      position: 'absolute',
      top: '4px',
      right: '4px',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: theme.colors.error.main,
      pointerEvents: 'none',
    }),
  };
}
