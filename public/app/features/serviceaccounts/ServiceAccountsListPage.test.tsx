import { render, screen } from '@testing-library/react';
import React from 'react';

import { OrgRole, ServiceAccountDTO, ServiceAccountStateFilter } from 'app/types';

import { Props, ServiceAccountsListPageUnconnected } from './ServiceAccountsListPage';

jest.mock('app/core/core', () => ({
  contextSrv: {
    licensedAccessControlEnabled: () => false,
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
  },
}));

const setup = (propOverrides: Partial<Props>) => {
  const changeQueryMock = jest.fn();
  const fetchACOptionsMock = jest.fn();
  const fetchServiceAccountsMock = jest.fn();
  const deleteServiceAccountMock = jest.fn();
  const updateServiceAccountMock = jest.fn();
  const changeStateFilterMock = jest.fn();
  const createServiceAccountTokenMock = jest.fn();
  const props: Props = {
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Service accounts',
      },
    },
    builtInRoles: {},
    isLoading: false,
    page: 0,
    perPage: 10,
    query: '',
    roleOptions: [],
    serviceAccountStateFilter: ServiceAccountStateFilter.All,
    showPaging: false,
    totalPages: 1,
    serviceAccounts: [],
    changeQuery: changeQueryMock,
    fetchACOptions: fetchACOptionsMock,
    fetchServiceAccounts: fetchServiceAccountsMock,
    deleteServiceAccount: deleteServiceAccountMock,
    updateServiceAccount: updateServiceAccountMock,
    changeStateFilter: changeStateFilterMock,
    createServiceAccountToken: createServiceAccountTokenMock,
  };

  Object.assign(props, propOverrides);

  const { rerender } = render(<ServiceAccountsListPageUnconnected {...props} />);
  return {
    rerender,
    props,
    changeQueryMock,
    fetchACOptionsMock,
    fetchServiceAccountsMock,
    deleteServiceAccountMock,
    updateServiceAccountMock,
    changeStateFilterMock,
    createServiceAccountTokenMock,
  };
};

const getDefaultServiceAccount: () => ServiceAccountDTO = () => ({
  id: 1,
  name: 'Data source scavenger',
  login: 'sa-data-source-scavenger',
  orgId: 1,
  role: OrgRole.Editor,
  isDisabled: false,
  teams: [],
  tokens: 1,
  createdAt: '2022-01-01 00:00:00',
});

describe('ServiceAccountsListPage tests', () => {
  it('Should display list of service accounts', () => {
    setup({
      serviceAccounts: [getDefaultServiceAccount()],
    });
    expect(screen.getByText(/Data source scavenger/)).toBeInTheDocument();
    expect(screen.getByText(/sa-data-source-scavenger/)).toBeInTheDocument();
    expect(screen.getByText(/Editor/)).toBeInTheDocument();
  });

  it('Should display enable button for disabled account', () => {
    setup({
      serviceAccounts: [
        {
          ...getDefaultServiceAccount(),
          isDisabled: true,
        },
      ],
    });
    expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
  });

  it('Should display Add token button for account without tokens', () => {
    setup({
      serviceAccounts: [
        {
          ...getDefaultServiceAccount(),
          tokens: 0,
        },
      ],
    });
    expect(screen.getByRole('button', { name: 'Add token' })).toBeInTheDocument();
    expect(screen.getByText(/No tokens/)).toBeInTheDocument();
  });
});
