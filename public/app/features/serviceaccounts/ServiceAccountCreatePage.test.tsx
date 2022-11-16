import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from '../../store/configureStore';

import { ServiceAccountCreatePage, Props } from './ServiceAccountCreatePage';

const postMock = jest.fn().mockResolvedValue({});
const patchMock = jest.fn().mockResolvedValue({});
const putMock = jest.fn().mockResolvedValue({});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    post: postMock,
    patch: patchMock,
    put: putMock,
  }),
  config: {
    loginError: false,
    buildInfo: {
      version: 'v1.0',
      commit: '1',
      env: 'production',
      edition: 'Open Source',
    },
    licenseInfo: {
      stateInfo: '',
      licenseUrl: '',
    },
    appSubUrl: '',
    featureToggles: {},
  },
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    licensedAccessControlEnabled: () => false,
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
    user: { orgId: 1 },
  },
}));

const setup = (propOverrides: Partial<Props>) => {
  const store = configureStore();
  const props: Props = {
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Service accounts',
      },
    },
  };

  Object.assign(props, propOverrides);

  render(
    <Provider store={store}>
      <ServiceAccountCreatePage {...props} />
    </Provider>
  );
};

describe('ServiceAccountCreatePage tests', () => {
  it('Should display service account create page', () => {
    setup({});
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('Should fire form validation error if name is not set', async () => {
    setup({});
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Display name is required')).toBeInTheDocument();
  });

  it('Should call API with proper params when creating new service account', async () => {
    setup({});
    await userEvent.type(screen.getByLabelText('Display name *'), 'Data source scavenger');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/api/serviceaccounts/', {
        name: 'Data source scavenger',
        role: 'Viewer',
      })
    );
  });
});
