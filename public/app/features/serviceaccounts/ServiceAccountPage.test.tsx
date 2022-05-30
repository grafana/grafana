import { render, screen } from '@testing-library/react';
import React from 'react';

import { ApiKey, OrgRole, ServiceAccountDTO } from 'app/types';

import { ServiceAccountPageUnconnected, Props } from './ServiceAccountPage';

jest.mock('app/core/core', () => ({
  contextSrv: {
    licensedAccessControlEnabled: () => false,
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
  },
}));

const setup = (propOverrides: Partial<Props>) => {
  const createServiceAccountTokenMock = jest.fn();
  const deleteServiceAccountMock = jest.fn();
  const deleteServiceAccountTokenMock = jest.fn();
  const loadServiceAccountMock = jest.fn();
  const loadServiceAccountTokensMock = jest.fn();
  const updateServiceAccountMock = jest.fn();

  const props: Props = {
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Service accounts',
      },
    },
    serviceAccount: {} as ServiceAccountDTO,
    tokens: [],
    builtInRoles: {},
    isLoading: false,
    roleOptions: [],
    match: {
      params: { id: '1' },
      isExact: true,
      path: '/org/serviceaccounts/1',
      url: 'http://localhost:3000/org/serviceaccounts/1',
    },
    history: {} as any,
    location: {} as any,
    queryParams: {},
    route: {} as any,
    timezone: '',
    createServiceAccountToken: createServiceAccountTokenMock,
    deleteServiceAccount: deleteServiceAccountMock,
    deleteServiceAccountToken: deleteServiceAccountTokenMock,
    loadServiceAccount: loadServiceAccountMock,
    loadServiceAccountTokens: loadServiceAccountTokensMock,
    updateServiceAccount: updateServiceAccountMock,
  };

  Object.assign(props, propOverrides);

  const { rerender } = render(<ServiceAccountPageUnconnected {...props} />);
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

const getDefaultToken: () => ApiKey = () => ({
  id: 1,
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
    expect(screen.getByText(/^Enable service account$/)).toBeInTheDocument();
  });

  it('Should display Add token button for account without tokens', () => {
    setup({
      serviceAccount: {
        ...getDefaultServiceAccount(),
        tokens: 0,
      },
    });
    expect(screen.getByText(/^Add service account token$/)).toBeInTheDocument();
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
});
