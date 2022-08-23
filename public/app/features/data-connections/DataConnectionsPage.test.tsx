import { render, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { getMockDataSources } from 'app/features/datasources/__mocks__';
import * as api from 'app/features/datasources/api';
import { configureStore } from 'app/store/configureStore';

import DataConnectionsPage from './DataConnectionsPage';
import { navIndex } from './__mocks__/store.navIndex.mock';
import { ROUTE_BASE_ID, ROUTES } from './constants';

jest.mock('app/features/datasources/api');

const renderPage = (path = `/${ROUTE_BASE_ID}`): RenderResult => {
  // @ts-ignore
  const store = configureStore({ navIndex });
  locationService.push(path);

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <DataConnectionsPage />
      </Router>
    </Provider>
  );
};

describe('Data Connections Page', () => {
  const mockDatasources = getMockDataSources(3);

  beforeEach(() => {
    (api.getDataSources as jest.Mock) = jest.fn().mockResolvedValue(mockDatasources);
  });

  test('shows all the four tabs', async () => {
    renderPage();

    expect(await screen.findByLabelText('Tab Data sources')).toBeVisible();
    expect(await screen.findByLabelText('Tab Plugins')).toBeVisible();
    expect(await screen.findByLabelText('Tab Cloud integrations')).toBeVisible();
    expect(await screen.findByLabelText('Tab Recorded queries')).toBeVisible();
  });

  test('shows the "Data sources" tab by default', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: /add data source/i })).toBeVisible();
    expect(await screen.findByText(mockDatasources[0].name)).toBeVisible();
  });

  test('renders the correct tab even if accessing it with a "sub-url"', async () => {
    renderPage(`${ROUTES.Plugins}/foo`);

    // Check if it still renders the plugins tab
    expect(await screen.findByText('The list of plugins is under development')).toBeVisible();
    expect(screen.queryByText('The list of data sources is under development.')).not.toBeInTheDocument();
  });
});
