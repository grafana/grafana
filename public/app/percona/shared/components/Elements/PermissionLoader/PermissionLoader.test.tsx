import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { PermissionLoader } from './PermissionLoader';

jest.mock('app/percona/settings/Settings.service');
jest.mock('app/percona/shared/helpers/logger', () => {
  const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('PermissionLoader', () => {
  it('should render success if feature is enabled after loading', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <PermissionLoader
          featureSelector={() => true}
          renderError={() => null}
          renderSuccess={() => <span data-testid="dummy-child" />}
        />
      </Provider>
    );
    expect(screen.getByTestId('dummy-child')).toBeInTheDocument();
  });

  it('should show loading if feature disabled and while getting settings', async () => {
    const { container } = render(
      <Provider store={configureStore({ percona: { settings: { loading: true } } } as StoreState)}>
        <PermissionLoader
          featureSelector={() => false}
          renderError={() => null}
          renderSuccess={() => <span data-testid="dummy-child" />}
        />
      </Provider>
    );
    expect(container.querySelector('.fa-spin')).toBeInTheDocument();
  });

  it('should render error if feature disabled and user is authorized', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            settings: { loading: false },
            user: { isAuthorized: true },
          },
        } as StoreState)}
      >
        <PermissionLoader
          featureSelector={() => false}
          renderError={() => <span data-testid="dummy-child" />}
          renderSuccess={() => null}
        />
      </Provider>
    );
    expect(screen.getByTestId('dummy-child')).toBeInTheDocument();
  });
});
