import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { UserDTO } from '../../../types';

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
    <Provider
            store={configureStore({
              percona: {
                user: { isAuthorized: true },
              },
            } as StoreState)}
          >
    <MemoryRouter>
      <UsersTable {...props} />
    </MemoryRouter>
    </Provider>
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
