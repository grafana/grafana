import { render, screen } from '@testing-library/react';

import { OrgRole } from '@grafana/data';

import { RolePickerDrawer } from './RolePickerDrawer';

const props = {
  onClose: () => {},
  user: {
    login: 'admin',
    email: '',
    avatarUrl: '',
    lastSeenAt: '',
    lastSeenAtAge: '',
    name: 'administrator',
    orgId: 1,
    role: OrgRole.Admin,
    roles: [],
    userId: 1,
    isDisabled: false,
  },
};

describe('RolePickerDrawer', () => {
  it('should render', async () => {
    render(<RolePickerDrawer {...props} />);

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'administrator' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'documentation' })).toBeInTheDocument();
  });
});
