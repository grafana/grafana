import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { NotificationChannel } from './NotificationChannel';

jest.mock('./NotificationChannel.service');

describe('NotificationChannel', () => {
  it('should render table correctly', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <NotificationChannel />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    expect((await screen.findByTestId('table-thead')).querySelectorAll('tr')).toHaveLength(1);
    expect((await screen.findByTestId('table-tbody')).querySelectorAll('tr')).toHaveLength(3);
    expect(screen.queryAllByTestId('table-no-data')).toHaveLength(0);
  });

  it('should render add modal', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <NotificationChannel />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    const button = screen.getByTestId('notification-channel-add-modal-button');
    fireEvent.click(button);

    expect(screen.getByTestId('modal-wrapper')).toBeInTheDocument();
  });
});
