import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OrgRole } from '@grafana/data';

import { RolePickerBadges } from './RolePickerBadges';

const props = {
  disabled: false,
  user: {
    login: 'admin',
    email: 'email@example.com',
    uid: 'uid',
    avatarUrl: 'avatarURL',
    lastSeenAt: 'lastSeenAt',
    lastSeenAtAge: 'lastSeenAtAge',
    name: 'administrator',
    orgId: 1,
    role: OrgRole.Admin,
    roles: [
      {
        uid: 'uid',
        name: 'admin',
        displayName: 'Admin',
        description: 'description',
        group: 'group',
        global: true,
        version: 1,
        created: 'created',
        updated: 'updated',
      },
    ],
    userId: 1,
    isDisabled: false,
  },
};

describe('RolePickerBadges', () => {
  it('should render', async () => {
    render(<RolePickerBadges {...props} />);

    expect(screen.getByText(/\+1/i)).toBeInTheDocument();

    expect(screen.getByText(/Admin/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText('Admin'));
  });
});
