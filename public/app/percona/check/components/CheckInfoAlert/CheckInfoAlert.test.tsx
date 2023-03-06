import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { ChecksInfoAlert } from './CheckInfoAlert';
import { Messages } from './CheckInfoAlert.messages';

describe('CheckInfoAlert', () => {
  it('should only show alert when PMM is not connected to portal', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <ChecksInfoAlert />
      </Provider>
    );
    expect(screen.getByText(Messages.title)).toBeInTheDocument();
  });

  it('should not show alert when PMM is connected to portal', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true } },
          },
        } as StoreState)}
      >
        <ChecksInfoAlert />
      </Provider>
    );
    expect(screen.queryByText(Messages.title)).not.toBeInTheDocument();
  });
});
