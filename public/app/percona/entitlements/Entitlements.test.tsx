import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { wrapWithGrafanaContextMock } from '../shared/helpers/testUtils';

import EntitlementsPage from './EntitlementsPage';

describe('EntitlementsPage', () => {
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
        {wrapWithGrafanaContextMock(<EntitlementsPage />)}
      </Provider>
    );
    expect(screen.getByTestId('page-wrapper-entitlements')).toBeInTheDocument();
  });
});
