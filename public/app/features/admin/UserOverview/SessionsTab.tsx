import { useMemo, useRef, useState } from 'react';

import { dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, type Column, ConfirmButton, ConfirmModal, InteractiveTable, Stack } from '@grafana/ui';
import {
  useAdminGetUserAuthTokensQuery,
  useAdminLogoutUserMutation,
  useAdminRevokeUserAuthTokenMutation,
} from 'app/api/clients/legacy';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { formatDate } from 'app/core/internationalization/dates';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type UserSession } from 'app/types/user';

import { ActionError } from './ActionError';
import { LoadState } from './LoadState';
import { type RunAction, useAction } from './hooks';

const collator = new Intl.Collator();
const mostRecentlySeenFirst = [{ id: 'seenAt', desc: true }];

// An active session counts as seen later than any timestamp.
const seenAt = (session: UserSession) => (session.isActive ? Number.MAX_SAFE_INTEGER : Date.parse(session.seenAt) || 0);
const browser = (session: UserSession) => `${session.browser} on ${session.os} ${session.osVersion}`;

function RevokeSessionButton({ uid, sessionId, run }: { uid: string; sessionId: number; run: RunAction }) {
  const [revokeSession, { isLoading }] = useAdminRevokeUserAuthTokenMutation();
  return (
    <ConfirmButton
      confirmText={t('admin.base-user-sessions.confirmText-confirm-logout', 'Confirm logout')}
      confirmVariant="destructive"
      disabled={isLoading}
      onConfirm={() => {
        run(revokeSession({ userId: uid, revokeAuthTokenCmd: { authTokenId: sessionId } }).unwrap());
      }}
    >
      {t('admin.user-sessions.force-logout-button', 'Force logout')}
    </ConfirmButton>
  );
}

export function SessionsTab({ uid }: { uid: string }) {
  const { currentData: sessions, error } = useAdminGetUserAuthTokensQuery({ userId: uid });
  const [logoutEverywhere] = useAdminLogoutUserMutation();
  const { run, error: actionError } = useAction();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const logoutEverywhereButton = useRef<HTMLButtonElement>(null);
  const canLogout = contextSrv.hasPermission(AccessControlAction.UsersLogout);
  const canRevokeSession = contextSrv.hasPermission(AccessControlAction.UsersAuthTokenUpdate);

  const columns = useMemo<Array<Column<UserSession>>>(
    () => [
      {
        id: 'seenAt',
        header: t('admin.user-sessions.last-seen-column', 'Last seen'),
        cell: ({ row: { original } }) =>
          original.isActive ? t('admin.user-sessions.now', 'Now') : dateTimeFormatTimeAgo(original.seenAt),
        sortType: (a, b) => seenAt(a.original) - seenAt(b.original),
        sortDescFirst: true,
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
          canRevokeSession && <RevokeSessionButton uid={uid} sessionId={original.id} run={run} />,
      },
    ],
    [canRevokeSession, run, uid]
  );

  if (error || !sessions) {
    return <LoadState error={error} />;
  }
  return (
    <Stack direction="column" gap={2}>
      {Boolean(actionError) && <ActionError error={actionError} />}
      <InteractiveTable
        columns={columns}
        data={sessions}
        getRowId={(session) => String(session.id)}
        initialSortBy={mostRecentlySeenFirst}
      />
      <div>
        {canLogout && sessions.length > 0 && (
          <Button variant="secondary" onClick={() => setShowLogoutModal(true)} ref={logoutEverywhereButton}>
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
            run(logoutEverywhere({ userId: uid }).unwrap());
          }}
          onDismiss={() => {
            setShowLogoutModal(false);
            logoutEverywhereButton.current?.focus();
          }}
        />
      </div>
    </Stack>
  );
}
