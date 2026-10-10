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
  return (
    <Stack direction="column" gap={3}>
      {(deletion.isError || disabling.isError || enabling.isError) && <ActionError />}
      <UserAccountActions
        user={user}
        onUserDelete={async () => {
          if (!('error' in (await deleteUser({ userId: user.uid })))) {
            locationService.push('/admin/users');
          }
        }}
        onUserDisable={() => disableUser({ userId: user.uid })}
        onUserEnable={() => enableUser({ userId: user.uid })}
      />
    </Stack>
  );
}
