import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { OrgRole } from '@grafana/data';

import { RolePickerDrawer } from './RolePickerDrawer';

const props = {
  onClose: jest.fn(),
  entityName: 'test-user',
  appliedRoles: [],
  roleOptions: [],
  basicRole: OrgRole.Editor,
  onBasicRoleChange: jest.fn(),
  onSave: jest.fn().mockResolvedValue(undefined),
  canUpdateRoles: true,
};

describe('RolePickerDrawer', () => {
  it('should render', () => {
    render(
      <TestProvider>
        <RolePickerDrawer {...props} />
      </TestProvider>
    );

    expect(screen.getByRole('heading', { name: 'test-user' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
