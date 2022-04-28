import React from 'react';
import { Provider } from 'react-redux';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { render, screen } from '@testing-library/react';
import TicketsPage from './TicketsPage';

describe('TicketsPage', () => {
  it('renders wrapper', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true } },
          },
        } as StoreState)}
      >
        <TicketsPage />
      </Provider>
    );
    expect(screen.getByTestId('page-wrapper-tickets')).toBeInTheDocument();
  });
});
