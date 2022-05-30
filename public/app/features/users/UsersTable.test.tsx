import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { OrgUser } from 'app/types';

import UsersTable, { Props } from './UsersTable';
import { getMockUsers } from './__mocks__/userMocks';

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
    licensedAccessControlEnabled: () => false,
  },
}));

function getProps(propOverrides?: object) {
  const props: Props = {
    users: [] as OrgUser[],
    onRoleChange: jest.fn(),
    onRemoveUser: jest.fn(),
  };

  return Object.assign(props, propOverrides);
}

describe('Render', () => {
  it('should render component', () => {
    render(<UsersTable {...getProps()} />);
  });

  it('should render users table', () => {
    render(
      <UsersTable
        {...getProps({
          users: getMockUsers(5),
        })}
      />
    );
  });
});

describe('Remove modal', () => {
  it('should render confirm check on delete', async () => {
    render(
      <UsersTable
        {...getProps({
          users: getMockUsers(3),
        })}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);

    expect(screen.getAllByText(/sure/i).length).toEqual(1);
  });
});
