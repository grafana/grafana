import React from 'react';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';
import { PlatformConnectedLoader } from '.';

describe('PlatformConnectedLoader', () => {
  it('should render error if user is not percona account and is connected to portal', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { loading: false, result: { isConnectedToPortal: true } },
          },
        } as StoreState)}
      >
        <PlatformConnectedLoader></PlatformConnectedLoader>
      </Provider>
    );
    expect(screen.getByTestId('not-platform-user')).toBeInTheDocument();
  });

  it('should render error if user is not percona account and is not connected to portal and is not authorized', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: false, isPlatformUser: false },
            settings: { loading: false, result: { isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <PlatformConnectedLoader></PlatformConnectedLoader>
      </Provider>
    );
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
  });

  it('should render error if user is not percona account and not connected to portal', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { loading: false, result: { isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <PlatformConnectedLoader></PlatformConnectedLoader>
      </Provider>
    );
    expect(screen.getByTestId('not-connected-platform')).toBeInTheDocument();
  });

  it('should render children when user is Percona account', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: true },
            settings: { loading: false, result: { isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <PlatformConnectedLoader>
          <div data-testId="dummy-child">Test</div>
        </PlatformConnectedLoader>
      </Provider>
    );
    expect(screen.getByTestId('dummy-child')).toBeInTheDocument();
  });
});
