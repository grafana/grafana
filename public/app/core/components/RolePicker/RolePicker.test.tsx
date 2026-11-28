import { render, screen, within, waitFor } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { type Role } from 'app/types/accessControl';

import { RolePicker } from './RolePicker';

const noRoles: Role[] = [];
const reader: Role = {
  uid: 'reader',
  name: 'custom:reader',
  displayName: 'Dashboard reader',
  filteredDisplayName: 'Dashboards:Dashboard reader',
  group: 'Dashboards',
  description: 'Read dashboards',
  delegatable: true,
  created: '2026-01-01T00:00:00Z',
  updated: '2026-01-01T00:00:00Z',
  version: 1,
};

it('restores the saved basic role after a rejected update and allows retrying', async () => {
  const onBasicRoleChange = jest.fn().mockRejectedValue(new Error('Last organization admin'));
  const onRolesChange = jest.fn();
  const { user } = render(
    <RolePicker
      basicRole={OrgRole.Admin}
      appliedRoles={[]}
      roleOptions={[]}
      showBasicRole
      onBasicRoleChange={onBasicRoleChange}
      onRolesChange={onRolesChange}
    />
  );
  for (let attempt = 1; attempt <= 2; attempt++) {
    await user.click(within(screen.getByTestId('role-picker')).getByText('Admin'));
    await user.click(screen.getByText('Editor'));
    await user.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(within(screen.getByTestId('role-picker')).getByText('Admin')).toBeInTheDocument());
    expect(onBasicRoleChange).toHaveBeenCalledTimes(attempt);
    expect(onBasicRoleChange).toHaveBeenLastCalledWith(OrgRole.Editor);
    expect(onRolesChange).not.toHaveBeenCalled();
  }
});

it('restores the applied roles after a rejected roles update', async () => {
  const onRolesChange = jest.fn().mockRejectedValue(new Error('Roles update rejected'));
  const { user } = render(
    <RolePicker
      basicRole={OrgRole.Viewer}
      appliedRoles={noRoles}
      roleOptions={[reader]}
      showBasicRole
      onRolesChange={onRolesChange}
    />
  );
  await user.click(within(screen.getByTestId('role-picker')).getByText('Viewer'));
  await user.click(within(screen.getByLabelText('Role picker menu')).getAllByRole('checkbox')[0]);
  await user.click(screen.getByRole('button', { name: 'Update' }));
  expect(onRolesChange).toHaveBeenCalledWith([reader]);
  await waitFor(() => expect(within(screen.getByTestId('role-picker')).queryByText('+1 role')).not.toBeInTheDocument());
  expect(within(screen.getByTestId('role-picker')).getByText('Viewer')).toBeInTheDocument();
});

it('does not send the roles when only the basic role changes', async () => {
  const onBasicRoleChange = jest.fn();
  const onRolesChange = jest.fn();
  const { user } = render(
    <RolePicker
      basicRole={OrgRole.Viewer}
      appliedRoles={[reader]}
      roleOptions={[reader]}
      showBasicRole
      onBasicRoleChange={onBasicRoleChange}
      onRolesChange={onRolesChange}
    />
  );
  await user.click(within(screen.getByTestId('role-picker')).getByText('Viewer'));
  await user.click(screen.getByText('Editor'));
  await user.click(screen.getByRole('button', { name: 'Update' }));
  await waitFor(() => expect(onBasicRoleChange).toHaveBeenCalledWith(OrgRole.Editor));
  expect(onRolesChange).not.toHaveBeenCalled();
});
