import { render, screen } from '@testing-library/react';

import { OrgRole } from '@grafana/data';

import { RolePickerBadges } from './RolePickerBadges';

const props = {
  disabled: false,
  onOpenDrawer: jest.fn(),
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
        filteredDisplayName: 'group:Admin',
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
  it('should render badges', () => {
    render(<RolePickerBadges {...props} />);

    expect(screen.getByText(/\+1/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin/i)).toBeInTheDocument();
  });
});
