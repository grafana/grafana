import { t } from '@grafana/i18n';
import { Alert, Stack, Text } from '@grafana/ui';
import {
  useAdminRevokeUserAuthTokenMutation,
  useAdminLogoutUserMutation,
  useAdminGetUserAuthTokensQuery,
} from 'app/api/clients/legacy';

import { UserSessions } from '../UserSessions';

import { ActionError } from './ActionError';

export function SessionsTab({ uid }: { uid: string }) {
  const [revokeSession, revoking] = useAdminRevokeUserAuthTokenMutation();
  const [revokeSessions, revokingAll] = useAdminLogoutUserMutation();
  const resetErrors = () => {
    revoking.reset();
    revokingAll.reset();
  };
  const { currentData: sessions, error } = useAdminGetUserAuthTokensQuery({ userId: uid });
  if (error) {
    return <Alert severity="warning" title={t('admin.user-overview.sessions-error', 'Unable to load sessions')} />;
  }
  if (!sessions) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  return (
    <Stack direction="column" gap={2}>
      {(revoking.isError || revokingAll.isError) && <ActionError error={revoking.error || revokingAll.error} />}
      <UserSessions
        sessions={sessions}
        onSessionRevoke={(authTokenId) => {
          resetErrors();
          return revokeSession({ userId: uid, revokeAuthTokenCmd: { authTokenId } });
        }}
        onAllSessionsRevoke={() => {
          resetErrors();
          return revokeSessions({ userId: uid });
        }}
      />
    </Stack>
  );
}
