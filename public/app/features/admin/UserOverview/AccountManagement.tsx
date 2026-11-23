import { locationService } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import {
  useAdminDeleteUserMutation,
  useAdminDisableUserMutation,
  useAdminEnableUserMutation,
} from 'app/api/clients/legacy';
import { type UserDTO } from 'app/types/user';

import { UserAccountActions } from '../UserAccountActions';

import { ActionError } from './ActionError';

export function AccountManagement({ user }: { user: UserDTO }) {
  const [deleteUser, deletion] = useAdminDeleteUserMutation();
  const [disableUser, disabling] = useAdminDisableUserMutation();
  const [enableUser, enabling] = useAdminEnableUserMutation();
  const resetErrors = () => {
    deletion.reset();
    disabling.reset();
    enabling.reset();
  };
  return (
    <Stack direction="column" gap={3}>
      {(deletion.isError || disabling.isError || enabling.isError) && (
        <ActionError error={deletion.error || disabling.error || enabling.error} />
      )}
      <UserAccountActions
        user={user}
        onUserDelete={async () => {
          resetErrors();
          if (!('error' in (await deleteUser({ userId: user.uid })))) {
            locationService.push('/admin/users');
          }
        }}
        onUserDisable={() => {
          resetErrors();
          return disableUser({ userId: user.uid });
        }}
        onUserEnable={() => {
          resetErrors();
          return enableUser({ userId: user.uid });
        }}
      />
    </Stack>
  );
}
