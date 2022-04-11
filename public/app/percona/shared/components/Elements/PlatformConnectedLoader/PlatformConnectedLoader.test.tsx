import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { PlatformConnectedLoader } from '.';

describe('PlatformConnectedLoader', () => {
  it('should render error if user is not percona account', async () => {
    render(
      <Provider
        store={configureStore({
          perconaSettings: { isLoading: false, isConnectedToPortal: true },
          perconaUser: { isAuthorized: true, isPlatformUser: false },
        } as StoreState)}
      >
        <PlatformConnectedLoader></PlatformConnectedLoader>
      </Provider>
    );
    expect(screen.getByTestId('not-platform-user')).toBeInTheDocument();
  });
});
