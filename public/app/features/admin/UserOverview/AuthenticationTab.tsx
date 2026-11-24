import { dateTimeFormat } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, LinkButton, Stack } from '@grafana/ui';
import { useGetSyncStatusQuery, usePostSyncUserWithLdapMutation } from 'app/api/clients/legacy';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type UserDTO } from 'app/types/user';

import { ActionError } from './ActionError';
import { DetailRow, DetailTable } from './DetailRows';
import { LoadState } from './LoadState';
import { useAction } from './hooks';

const nextSyncFormat = 'dddd YYYY-MM-DD HH:mm zz';

export function AuthenticationTab({ user }: { user: UserDTO }) {
  const [syncUser] = usePostSyncUserWithLdapMutation();
  const { currentData: syncInfo, error } = useGetSyncStatusQuery();
  const { run, error: actionError } = useAction();
  const canReadLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersRead);
  const canSyncLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersSync);

  if (error || !syncInfo) {
    return <LoadState error={error} />;
  }
  let nextSync = t('admin.ldap-sync.not-enabled', 'Not enabled');
  if (syncInfo.enabled) {
    nextSync = syncInfo.nextSync ? dateTimeFormat(syncInfo.nextSync, { format: nextSyncFormat }) : '';
  }

  return (
    <Stack direction="column" gap={2}>
      {Boolean(actionError) && <ActionError error={actionError} />}
      <DetailTable>
        <DetailRow
          label={t('admin.ldap-sync.external-sync-label', 'External sync')}
          value={t(
            'admin.ldap-sync.external-sync-description',
            'User synced via LDAP. Some changes must be done in LDAP or mappings.'
          )}
        />
        <DetailRow label={t('admin.ldap-sync.next-sync-label', 'Next scheduled synchronization')} value={nextSync} />
      </DetailTable>
      <Stack gap={2}>
        {canSyncLDAPUser && (
          <Button
            variant="secondary"
            onClick={() => {
              run(syncUser({ userId: user.id }).unwrap());
            }}
          >
            <Trans i18nKey="admin.ldap-sync.sync-button">Sync user</Trans>
          </Button>
        )}
        {canReadLDAPUser && (
          <LinkButton variant="secondary" href={`/admin/authentication/ldap?username=${user.login}`}>
            <Trans i18nKey="admin.ldap-sync.debug-button">Debug LDAP Mapping</Trans>
          </LinkButton>
        )}
      </Stack>
    </Stack>
  );
}
