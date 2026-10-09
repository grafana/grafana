import { t } from '@grafana/i18n';
import { Alert, Stack, Text } from '@grafana/ui';
import {
  useAddOrgUserMutation,
  useRemoveOrgUserMutation,
  useUpdateOrgUserMutation,
  useGetUserOrgListQuery,
} from 'app/api/clients/legacy';
import { type UserDTO } from 'app/types/user';

import { UserOrgs } from '../UserOrgs';

import { ActionError } from './ActionError';

export function OrganizationsTab({ user }: { user: UserDTO }) {
  const [addOrgUser, adding] = useAddOrgUserMutation();
  const [removeOrgUser, removing] = useRemoveOrgUserMutation();
  const [updateOrgRole, updating] = useUpdateOrgUserMutation();
  const { currentData: orgs, error } = useGetUserOrgListQuery({ userId: user.uid });
  if (error) {
    return <Alert severity="warning" title={t('admin.user-overview.orgs-error', 'Unable to load organizations')} />;
  }
  if (!orgs) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  return (
    <Stack direction="column" gap={2}>
      {(adding.isError || removing.isError || updating.isError) && <ActionError />}
      <UserOrgs
        user={user}
        orgs={orgs}
        isExternalUser={user.isExternallySynced || user.isProvisioned}
        onOrgAdd={(orgId, role) => addOrgUser({ orgId, addOrgUserCommand: { loginOrEmail: user.login, role } })}
        onOrgRemove={(orgId) => removeOrgUser({ orgId, userId: user.uid })}
        onOrgRoleChange={(orgId, role) => updateOrgRole({ orgId, userId: user.uid, updateOrgUserCommand: { role } })}
      />
    </Stack>
  );
}
