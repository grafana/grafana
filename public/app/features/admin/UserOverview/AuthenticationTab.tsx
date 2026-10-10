import { t } from '@grafana/i18n';
import { Alert, Stack, Text } from '@grafana/ui';
import { useGetSyncStatusQuery, usePostSyncUserWithLdapMutation } from 'app/api/clients/legacy';
import { type UserDTO } from 'app/types/user';

import { UserLdapSyncInfo } from '../UserLdapSyncInfo';

import { ActionError } from './ActionError';

export function AuthenticationTab({ user }: { user: UserDTO }) {
  const [syncUser, syncing] = usePostSyncUserWithLdapMutation();
  const { currentData: status, error } = useGetSyncStatusQuery();
  if (error) {
    return (
      <Alert
        severity="warning"
        title={t('admin.user-overview.ldap-error', 'Unable to load authentication information')}
      />
    );
  }
  if (!status) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  return (
    <Stack direction="column" gap={2}>
      {syncing.isError && <ActionError />}
      <UserLdapSyncInfo user={user} ldapSyncInfo={status} onUserSync={() => syncUser({ userId: user.id })} />
    </Stack>
  );
}
