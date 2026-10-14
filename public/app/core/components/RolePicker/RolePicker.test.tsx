import { render, screen, within, waitFor } from 'test/test-utils';

import { OrgRole } from '@grafana/data';

import { RolePicker } from './RolePicker';

it('restores the saved basic role after a rejected update and allows retrying', async () => {
  const onBasicRoleChange = jest.fn().mockRejectedValue(new Error('Last organization admin'));
  const { user } = render(
    <RolePicker
      basicRole={OrgRole.Admin}
      appliedRoles={[]}
      roleOptions={[]}
      showBasicRole
      onBasicRoleChange={onBasicRoleChange}
      onRolesChange={jest.fn()}
    />
  );
  for (let attempt = 1; attempt <= 2; attempt++) {
    await user.click(within(screen.getByTestId('role-picker')).getByText('Admin'));
    await user.click(screen.getByText('Editor'));
    await user.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(within(screen.getByTestId('role-picker')).getByText('Admin')).toBeInTheDocument());
    expect(onBasicRoleChange).toHaveBeenCalledTimes(attempt);
    expect(onBasicRoleChange).toHaveBeenLastCalledWith(OrgRole.Editor);
  }
});
