import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { UserDTO } from 'app/types/user';

import { UsersTable, UsersTableProps } from './UsersTable';

const setup = (propOverrides?: object) => {
  const props: UsersTableProps = {
    users: [] as UserDTO[],
    showPaging: true,
    totalPages: 1,
    onChangePage: jest.fn(),
    currentPage: 1,
    fetchData: jest.fn(),
  };

  Object.assign(props, propOverrides);

  render(
    <MemoryRouter>
      <UsersTable {...props} />
    </MemoryRouter>
  );
};

describe('Render', () => {
  it('should render component', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should render when user has licensed role None', () => {
    expect(() =>
      setup({
        users: [
          {
            id: 1,
            uid: '1',
            login: '1',
            email: '1',
            name: '1',
            isGrafanaAdmin: false,
            isDisabled: false,
            licensedRole: 'None',
          },
        ],
      })
    ).not.toThrow();
  });

  it('should render when user belongs to org', () => {
    expect(() =>
      setup({
        users: [
          {
            id: 1,
            uid: '1',
            login: '1',
            email: '1',
            name: '1',
            isGrafanaAdmin: false,
            isDisabled: false,
            orgs: [{ name: 'test', url: 'test' }],
          },
        ],
      })
    ).not.toThrow();
  });
});
