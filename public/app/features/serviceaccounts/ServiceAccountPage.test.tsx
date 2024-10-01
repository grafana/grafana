import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { ApiKey, OrgRole, ServiceAccountDTO } from 'app/types';

import { ServiceAccountPageUnconnected, Props } from './ServiceAccountPage';

jest.mock('app/core/core', () => ({
  contextSrv: {
    licensedAccessControlEnabled: () => false,
    hasPermission: () => true,
    hasPermissionInMetadata: () => false,
  },
}));

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: () => ({ id: '1' }),
}));

const setup = (propOverrides: Partial<Props>) => {
  const createServiceAccountTokenMock = jest.fn();
  const deleteServiceAccountMock = jest.fn();
  const deleteServiceAccountTokenMock = jest.fn();
  const loadServiceAccountMock = jest.fn();
  const loadServiceAccountTokensMock = jest.fn();
  const updateServiceAccountMock = jest.fn();

  const props: Props = {
    serviceAccount: {} as ServiceAccountDTO,
    tokens: [],
    isLoading: false,
    timezone: '',
    createServiceAccountToken: createServiceAccountTokenMock,
    deleteServiceAccount: deleteServiceAccountMock,
    deleteServiceAccountToken: deleteServiceAccountTokenMock,
    loadServiceAccount: loadServiceAccountMock,
    loadServiceAccountTokens: loadServiceAccountTokensMock,
    updateServiceAccount: updateServiceAccountMock,
  };

  Object.assign(props, propOverrides);

  const { rerender } = render(
    <TestProvider>
      <ServiceAccountPageUnconnected {...props} />
    </TestProvider>
  );
  return {
    rerender,
    props,
    createServiceAccountTokenMock,
    deleteServiceAccountMock,
    deleteServiceAccountTokenMock,
    loadServiceAccountMock,
    loadServiceAccountTokensMock,
    updateServiceAccountMock,
  };
};

const getDefaultServiceAccount = (): ServiceAccountDTO => ({
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

const getDefaultToken = (): ApiKey => ({
  id: 142,
  name: 'sa-data-source-scavenger-74f1634b-3273-4da6-994b-24bd32f5bdc6',
  role: OrgRole.Viewer,
  secondsToLive: null,
  created: '2022-01-01 00:00:00',
});

describe('ServiceAccountPage tests', () => {
  it('Should display service account info', () => {
    setup({
      serviceAccount: getDefaultServiceAccount(),
      tokens: [getDefaultToken()],
    });
    expect(screen.getAllByText(/Data source scavenger/)).toHaveLength(2);
    expect(screen.getByText(/^sa-data-source-scavenger$/)).toBeInTheDocument();
    expect(screen.getByText(/Editor/)).toBeInTheDocument();
  });

  it('Should display enable button for disabled account', () => {
    setup({
      serviceAccount: {
        ...getDefaultServiceAccount(),
        isDisabled: true,
      },
      tokens: [getDefaultToken()],
    });
    expect(screen.getByRole('button', { name: 'Enable service account' })).toBeInTheDocument();
  });

  it('Should display Add token button for account without tokens', () => {
    setup({
      serviceAccount: {
        ...getDefaultServiceAccount(),
        tokens: 0,
      },
    });
    expect(screen.getByRole('button', { name: 'Add service account token' })).toBeInTheDocument();
  });

  it('Should display token info', () => {
    setup({
      serviceAccount: getDefaultServiceAccount(),
      tokens: [getDefaultToken()],
    });
    expect(screen.getByText(/sa-data-source-scavenger-74f1634b-3273-4da6-994b-24bd32f5bdc6/)).toBeInTheDocument();
  });

  it('Should display expired status for expired tokens', () => {
    setup({
      serviceAccount: getDefaultServiceAccount(),
      tokens: [
        {
          ...getDefaultToken(),
          expiration: '2022-01-02 00:00:00',
          hasExpired: true,
        },
      ],
    });
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
  });

  it('Should call API with proper params when edit service account info', async () => {
    const updateServiceAccountMock = jest.fn();
    setup({
      serviceAccount: getDefaultServiceAccount(),
      updateServiceAccount: updateServiceAccountMock,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Foo bar');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateServiceAccountMock).toHaveBeenCalledWith({
      ...getDefaultServiceAccount(),
      name: 'Foo bar',
    });
  });

  it('Should call API with proper params when delete service account token', async () => {
    const deleteServiceAccountTokenMock = jest.fn();
    setup({
      serviceAccount: getDefaultServiceAccount(),
      tokens: [getDefaultToken()],
      deleteServiceAccountToken: deleteServiceAccountTokenMock,
    });

    const user = userEvent.setup();
    await userEvent.click(screen.getByLabelText(/Delete service account token/));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));

    expect(deleteServiceAccountTokenMock).toHaveBeenCalledWith(42, 142);
  });
});
