import { render, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { getMockDataSources } from 'app/features/datasources/__mocks__';
import * as api from 'app/features/datasources/api';
import { configureStore } from 'app/store/configureStore';

import { getPluginsStateMock } from '../plugins/admin/__mocks__';

import ConnectionsPage from './ConnectionsPage';
import { navIndex } from './__mocks__/store.navIndex.mock';
import { ROUTE_BASE_ID, ROUTES } from './constants';

jest.mock('app/features/datasources/api');

const renderPage = (path = `/${ROUTE_BASE_ID}`): RenderResult => {
  // @ts-ignore
  const store = configureStore({ navIndex, plugins: getPluginsStateMock([]) });
  locationService.push(path);

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <ConnectionsPage />
      </Router>
    </Provider>
  );
};

describe('Connections Page', () => {
  const mockDatasources = getMockDataSources(3);

  beforeEach(() => {
    (api.getDataSources as jest.Mock) = jest.fn().mockResolvedValue(mockDatasources);
  });

  test('shows all tabs', async () => {
    renderPage();

    expect(await screen.findByLabelText('Tab Data sources')).toBeVisible();
    expect(await screen.findByLabelText('Tab Connect Data')).toBeVisible();
  });

  test('shows the "Data sources" tab by default', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: /add data source/i })).toBeVisible();
    expect(await screen.findByText(mockDatasources[0].name)).toBeVisible();
  });

  test('renders the correct tab even if accessing it with a "sub-url"', async () => {
    renderPage(`${ROUTES.ConnectData}`);

    expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();
  });
});
