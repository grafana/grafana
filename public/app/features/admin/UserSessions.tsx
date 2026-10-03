import { memo, useRef, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { ConfirmButton, ConfirmModal, Button, Stack } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { formatDate } from 'app/core/internationalization/dates';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type UserSession } from 'app/types/user';

import { UserSortableHeader, useUserTableSort } from './UserTableSorting';

interface Props {
  sessions: Array<UserSession & { seenAtTimestamp?: number }>;
  showHeading?: boolean;

  onSessionRevoke: (id: number) => void;
  onAllSessionsRevoke: () => void;
}

export const UserSessions = memo(({ sessions, onSessionRevoke, onAllSessionsRevoke, showHeading = true }: Props) => {
  const { sortedRows, headerProps } = useUserTableSort(sessions, {
    seenAt: (session) =>
      session.isActive ? Number.MAX_SAFE_INTEGER : (session.seenAtTimestamp ?? (Date.parse(session.seenAt) || 0)),
    createdAt: (session) => Date.parse(session.createdAt) || 0,
    clientIp: (session) => session.clientIp,
    browser: (session) => `${session.browser} on ${session.os} ${session.osVersion}`,
    authModule: (session) => session.authModule ?? '',
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const forceAllLogoutButton = useRef<HTMLButtonElement>(null);

  const showLogoutConfirmationModal = () => {
    setShowLogoutModal(true);
  };

  const dismissLogoutConfirmationModal = () => {
    setShowLogoutModal(false);
    forceAllLogoutButton.current?.focus();
  };

  const handleSessionRevoke = (id: number) => {
    return () => {
      onSessionRevoke(id);
    };
  };

  const handleAllSessionsRevoke = () => {
    setShowLogoutModal(false);
    onAllSessionsRevoke();
  };

  const canLogout = contextSrv.hasPermission(AccessControlAction.UsersLogout);
  const canRevokeSession = contextSrv.hasPermission(AccessControlAction.UsersAuthTokenUpdate);

  return (
    <div>
      {showHeading && (
        <h3 className="page-heading">
          <Trans i18nKey="admin.user-sessions.title">Sessions</Trans>
        </h3>
      )}
      <Stack direction="column" gap={1.5}>
        <div>
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <UserSortableHeader {...headerProps('seenAt')}>
                  <Trans i18nKey="admin.user-sessions.last-seen-column">Last seen</Trans>
                </UserSortableHeader>
                <UserSortableHeader {...headerProps('createdAt')}>
                  <Trans i18nKey="admin.user-sessions.logged-on-column">Logged on</Trans>
                </UserSortableHeader>
                <UserSortableHeader {...headerProps('clientIp')}>
                  <Trans i18nKey="admin.user-sessions.ip-column">IP address</Trans>
                </UserSortableHeader>
                <UserSortableHeader {...headerProps('browser')}>
                  <Trans i18nKey="admin.user-sessions.browser-column">Browser and OS</Trans>
                </UserSortableHeader>
                <UserSortableHeader {...headerProps('authModule')}>
                  <Trans i18nKey="user-session.auth-module-column">Identity Provider</Trans>
                </UserSortableHeader>
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((session, index) => (
                <tr key={`${session.id}-${index}`}>
                  <td>{session.isActive ? t('admin.user-sessions.now', 'Now') : session.seenAt}</td>
                  <td>{formatDate(session.createdAt, { dateStyle: 'long' })}</td>
                  <td>{session.clientIp}</td>
                  <td>{`${session.browser} on ${session.os} ${session.osVersion}`}</td>
                  <td>{session.authModule && <TagBadge label={session.authModule} removeIcon={false} count={0} />}</td>
                  <td>
                    {canRevokeSession && (
                      <ConfirmButton
                        confirmText={t('admin.base-user-sessions.confirmText-confirm-logout', 'Confirm logout')}
                        confirmVariant="destructive"
                        onConfirm={handleSessionRevoke(session.id)}
                      >
                        {t('admin.user-sessions.force-logout-button', 'Force logout')}
                      </ConfirmButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          {canLogout && sessions.length > 0 && (
            <Button variant="secondary" onClick={showLogoutConfirmationModal} ref={forceAllLogoutButton}>
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
            onConfirm={handleAllSessionsRevoke}
            onDismiss={dismissLogoutConfirmationModal}
          />
        </div>
      </Stack>
    </div>
  );
});
UserSessions.displayName = 'UserSessions';
