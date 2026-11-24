import { Stack } from '@grafana/ui';
import {
  useAddOrgUserMutation,
  useGetUserOrgListQuery,
  useRemoveOrgUserMutation,
  useUpdateOrgUserMutation,
} from 'app/api/clients/legacy';
import { type UserDTO } from 'app/types/user';

import { UserOrgs } from '../UserOrgs';

import { ActionError } from './ActionError';
import { LoadState } from './LoadState';
import { useAction } from './hooks';

export function OrganizationsTab({ user }: { user: UserDTO }) {
  const [addOrgUser] = useAddOrgUserMutation();
  const [removeOrgUser] = useRemoveOrgUserMutation();
  const [updateOrgRole] = useUpdateOrgUserMutation();
  const { currentData: orgs, error } = useGetUserOrgListQuery({ userId: user.uid });
  const { run, error: actionError } = useAction();

  if (error || !orgs) {
    return <LoadState error={error} />;
  }
  return (
    <Stack direction="column" gap={2}>
      {Boolean(actionError) && <ActionError error={actionError} />}
      <UserOrgs
        user={user}
        orgs={orgs}
        isExternalUser={user.isExternallySynced || user.isProvisioned}
        onOrgAdd={(orgId, role) => {
          run(addOrgUser({ orgId, addOrgUserCommand: { loginOrEmail: user.login, role } }).unwrap());
        }}
        onOrgRemove={(orgId) => {
          run(removeOrgUser({ orgId, userId: user.uid }).unwrap());
        }}
        onOrgRoleChange={(orgId, role) => {
          const update = updateOrgRole({ orgId, userId: user.uid, updateOrgUserCommand: { role } }).unwrap();
          run(update);
          // The role picker awaits the write itself, to drop its selection when the server rejects it.
          return update;
        }}
      />
    </Stack>
  );
}
