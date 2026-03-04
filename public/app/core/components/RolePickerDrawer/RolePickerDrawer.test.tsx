import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { OrgRole } from '@grafana/data';

import { RolePickerDrawer } from './RolePickerDrawer';

const props = {
  onClose: jest.fn(),
  userName: 'test-user',
  userId: 1,
  orgId: 1,
  basicRole: OrgRole.Editor,
  onBasicRoleChange: jest.fn(),
};

describe('RolePickerDrawer', () => {
  it('should render', () => {
    // useInheritedRoles makes async API calls that produce act() warnings in tests
    jest.spyOn(console, 'error').mockImplementation();

    render(
      <TestProvider>
        <RolePickerDrawer {...props} />
      </TestProvider>
    );

    expect(screen.getByRole('heading', { name: 'test-user' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'documentation' })).toBeInTheDocument();
  });
});
