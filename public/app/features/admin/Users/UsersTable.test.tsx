import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { type UserDTO } from 'app/types/user';

import { UsersTable, type UsersTableProps } from './UsersTable';

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
  it('should render component', async () => {
    //Adding this due to React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => setup()).not.toThrow();
    jest.spyOn(console, 'warn').mockRestore();
    expect(await screen.findByText('Login')).toBeInTheDocument();
  });

  it('should render when user has licensed role None', async () => {
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
    expect(await screen.findByText('Not assigned')).toBeInTheDocument();
  });

  it('should render when user belongs to org', async () => {
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
    expect(await screen.findByText('test')).toBeInTheDocument();
  });
});
