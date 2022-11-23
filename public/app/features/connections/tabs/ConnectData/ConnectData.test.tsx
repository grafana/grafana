import { fireEvent, render, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { CatalogPlugin } from 'app/features/plugins/admin/types';
import { configureStore } from 'app/store/configureStore';

import { getCatalogPluginMock, getPluginsStateMock } from '../../../plugins/admin/__mocks__';

import { ConnectData } from './ConnectData';

jest.mock('app/features/datasources/api');

const renderPage = (plugins: CatalogPlugin[] = []): RenderResult => {
  // @ts-ignore
  const store = configureStore({ plugins: getPluginsStateMock(plugins) });

  return render(
    <Provider store={store}>
      <ConnectData />
    </Provider>
  );
};

describe('Connect Data', () => {
  test('renders no results if the plugins list is empty', async () => {
    renderPage();

    expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();
  });

  test('renders card if plugins list is populated', async () => {
    renderPage([getCatalogPluginMock()]);

    expect(await screen.findByText('Zabbix')).toBeVisible();
  });

  test('renders card if search term matches', async () => {
    renderPage([getCatalogPluginMock()]);
    const searchField = await screen.findByRole('textbox');

    fireEvent.change(searchField, { target: { value: 'abbi' } });
    expect(await screen.findByText('Zabbix')).toBeVisible();

    fireEvent.change(searchField, { target: { value: 'rabbit' } });
    expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();
  });
});
