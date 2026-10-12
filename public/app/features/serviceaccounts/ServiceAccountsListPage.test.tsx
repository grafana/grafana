import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { OrgRole } from '@grafana/data';
import { ServiceAccountStateFilter, type ServiceAccountDTO } from 'app/types/serviceaccount';

import { type Props, ServiceAccountsListPageUnconnected } from './ServiceAccountsListPage';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    licensedAccessControlEnabled: () => false,
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
  },
}));

const setup = (propOverrides: Partial<Props>) => {
  const changePageMock = jest.fn();
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
    changePage: changePageMock,
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
  uid: 'aaaaa',
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
  it('Should display list of service accounts', async () => {
    setup({
      serviceAccounts: [getDefaultServiceAccount()],
    });
    expect(await screen.findByText(/Data source scavenger/)).toBeInTheDocument();
    expect(screen.getByText(/sa-data-source-scavenger/)).toBeInTheDocument();
    expect(screen.getByText(/Editor/)).toBeInTheDocument();
  });

  it('Should display enable button for disabled account', async () => {
    setup({
      serviceAccounts: [
        {
          ...getDefaultServiceAccount(),
          isDisabled: true,
        },
      ],
    });
    expect(await screen.findByRole('button', { name: 'Enable' })).toBeInTheDocument();
  });

  it('Should display Add token button for account without tokens', async () => {
    setup({
      serviceAccounts: [
        {
          ...getDefaultServiceAccount(),
          tokens: 0,
        },
      ],
    });
    expect(await screen.findByRole('button', { name: 'Add token' })).toBeInTheDocument();
    expect(screen.getByText(/No tokens/)).toBeInTheDocument();
  });

  it('Should update service account role', async () => {
    const updateServiceAccountMock = jest.fn();
    setup({
      serviceAccounts: [getDefaultServiceAccount()],
      updateServiceAccount: updateServiceAccountMock,
    });

    const user = userEvent.setup();
    await user.click(await screen.findByText('Editor'));
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
    await user.click(await screen.findByRole('button', { name: /Disable/ }));
    await user.click(screen.getByRole('button', { name: 'Disable service account' }));

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
    await user.click(await screen.findByLabelText(`Delete service account ${getDefaultServiceAccount().name}`));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteServiceAccountMock).toHaveBeenCalledWith('aaaaa');
  });
});
