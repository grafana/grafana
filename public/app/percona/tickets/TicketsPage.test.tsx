import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

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
        <GrafanaContext.Provider value={getGrafanaContextMock()}>
          <TicketsPage />
        </GrafanaContext.Provider>
      </Provider>
    );
    expect(screen.getByTestId('page-wrapper-tickets')).toBeInTheDocument();
  });
});
