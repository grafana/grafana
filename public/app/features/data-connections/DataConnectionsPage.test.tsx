import { render, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import DataConnectionsPage from './DataConnectionsPage';
import navIndex from './__mocks__/store.navIndex.mock';
import { ROUTE_BASE_ID } from './constants';

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
  test('shows all the four tabs', async () => {
    renderPage();

    expect(await screen.findByLabelText('Tab Data sources')).toBeVisible();
    expect(await screen.findByLabelText('Tab Plugins')).toBeVisible();
    expect(await screen.findByLabelText('Tab Cloud integrations')).toBeVisible();
    expect(await screen.findByLabelText('Tab Recorded queries')).toBeVisible();
  });

  test('shows the "Data sources" tab by default', async () => {
    renderPage();

    expect(await screen.findByText('The list of data sources is under development.')).toBeVisible();
  });
});
