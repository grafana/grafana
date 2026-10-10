import { memo, useMemo, useRef, useState } from 'react';

import { dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type Column, ConfirmButton, ConfirmModal, Button, Stack } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { formatDate } from 'app/core/internationalization/dates';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type UserSession } from 'app/types/user';

import { UserTable } from './UserOverview/UserTable';

const collator = new Intl.Collator();

interface Props {
  sessions: UserSession[];
  onSessionRevoke: (id: number) => void;
  onAllSessionsRevoke: () => void;
}

export const UserSessions = memo(({ sessions, onSessionRevoke, onAllSessionsRevoke }: Props) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const forceAllLogoutButton = useRef<HTMLButtonElement>(null);
  const canLogout = contextSrv.hasPermission(AccessControlAction.UsersLogout);
  const canRevokeSession = contextSrv.hasPermission(AccessControlAction.UsersAuthTokenUpdate);
  const columns = useMemo<Array<Column<UserSession>>>(() => {
    const seenAt = (session: UserSession) =>
      session.isActive ? Number.MAX_SAFE_INTEGER : Date.parse(session.seenAt) || 0;
    const browser = (session: UserSession) => `${session.browser} on ${session.os} ${session.osVersion}`;
    return [
      {
        id: 'seenAt',
        header: t('admin.user-sessions.last-seen-column', 'Last seen'),
        cell: ({ row: { original } }) =>
          original.isActive ? t('admin.user-sessions.now', 'Now') : dateTimeFormatTimeAgo(original.seenAt),
        sortType: (a, b) => seenAt(a.original) - seenAt(b.original),
      },
      {
        id: 'createdAt',
        header: t('admin.user-sessions.logged-on-column', 'Logged on'),
        cell: ({ row: { original } }) => formatDate(original.createdAt, { dateStyle: 'long' }),
        sortType: (a, b) => Date.parse(a.original.createdAt) - Date.parse(b.original.createdAt),
      },
      { id: 'clientIp', header: t('admin.user-sessions.ip-column', 'IP address'), sortType: 'string' },
      {
        id: 'browser',
        header: t('admin.user-sessions.browser-column', 'Browser and OS'),
        cell: ({ row: { original } }) => browser(original),
        sortType: (a, b) => collator.compare(browser(a.original), browser(b.original)),
      },
      {
        id: 'authModule',
        header: t('user-session.auth-module-column', 'Identity Provider'),
        sortType: 'string',
        cell: ({ row: { original } }) =>
          original.authModule && <TagBadge label={original.authModule} removeIcon={false} count={0} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row: { original } }) =>
          canRevokeSession && (
            <ConfirmButton
              confirmText={t('admin.base-user-sessions.confirmText-confirm-logout', 'Confirm logout')}
              confirmVariant="destructive"
              onConfirm={() => onSessionRevoke(original.id)}
            >
              {t('admin.user-sessions.force-logout-button', 'Force logout')}
            </ConfirmButton>
          ),
      },
    ];
  }, [canRevokeSession, onSessionRevoke]);

  return (
    <Stack direction="column" gap={1.5}>
      <UserTable columns={columns} data={sessions} getRowId={(session) => String(session.id)} />
      <div>
        {canLogout && sessions.length > 0 && (
          <Button variant="secondary" onClick={() => setShowLogoutModal(true)} ref={forceAllLogoutButton}>
            <Trans i18nKey="admin.user-sessions.force-logout-all-button">Force logout from all devices</Trans>
          </Button>
        )}
        <ConfirmModal
          isOpen={showLogoutModal}
          title={t('admin.base-user-sessions.title-force-logout-from-all-devices', 'Force logout from all devices')}
          body={t(
            'admin.base-user-sessions.body-force-logout-from-all-devices',
            'Are you sure you want to force logout from all devices?'
          )}
          confirmText={t('admin.base-user-sessions.confirmText-force-logout', 'Force logout')}
          onConfirm={() => {
            setShowLogoutModal(false);
            onAllSessionsRevoke();
          }}
          onDismiss={() => {
            setShowLogoutModal(false);
            forceAllLogoutButton.current?.focus();
          }}
        />
      </div>
    </Stack>
  );
});
UserSessions.displayName = 'UserSessions';
