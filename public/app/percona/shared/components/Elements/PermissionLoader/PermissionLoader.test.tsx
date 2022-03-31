import React from 'react';
import { Provider } from 'react-redux';
import { PermissionLoader } from './PermissionLoader';
import { render, screen } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

jest.mock('app/percona/settings/Settings.service');
jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('PermissionLoader', () => {
  it('should render success if feature is enabled', async () => {
    render(
      <Provider store={configureStore()}>
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
      <Provider store={configureStore({ perconaSettings: { isLoading: true } } as StoreState)}>
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
          perconaSettings: { isLoading: false },
          perconaUser: { isAuthorized: true },
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

  it('should show unauthorized message if feature disabled', async () => {
    render(
      <Provider
        store={configureStore({
          perconaSettings: { isLoading: false },
          perconaUser: { isAuthorized: false },
        } as StoreState)}
      >
        <PermissionLoader featureSelector={() => false} renderError={() => null} renderSuccess={() => null} />
      </Provider>
    );
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
  });
});
