import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

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

  const { rerender } = render(
    <TestProvider>
      <ServiceAccountsListPageUnconnected {...props} />
    </TestProvider>
  );
  return {
    rerender: (element: JSX.Element) => rerender(<TestProvider>{element}</TestProvider>),
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
  id: 42,
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

  it('Should update service account role', async () => {
    const updateServiceAccountMock = jest.fn();
    setup({
      serviceAccounts: [getDefaultServiceAccount()],
      updateServiceAccount: updateServiceAccountMock,
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Editor'));
    await user.click(screen.getByText('Admin'));

    expect(updateServiceAccountMock).toHaveBeenCalledWith({
      ...getDefaultServiceAccount(),
      role: OrgRole.Admin,
    });
  });

  it('Should disable service account', async () => {
    const updateServiceAccountMock = jest.fn();
    setup({
      serviceAccounts: [getDefaultServiceAccount()],
      updateServiceAccount: updateServiceAccountMock,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Disable/ }));
    await user.click(screen.getByLabelText(/Confirm Modal Danger Button/));

    expect(updateServiceAccountMock).toHaveBeenCalledWith({
      ...getDefaultServiceAccount(),
      isDisabled: true,
    });
  });

  it('Should remove service account', async () => {
    const deleteServiceAccountMock = jest.fn();
    setup({
      serviceAccounts: [getDefaultServiceAccount()],
      deleteServiceAccount: deleteServiceAccountMock,
    });

    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Delete service account/));
    await user.click(screen.getByLabelText(/Confirm Modal Danger Button/));

    expect(deleteServiceAccountMock).toHaveBeenCalledWith(42);
  });
});
