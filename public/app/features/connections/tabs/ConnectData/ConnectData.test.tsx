import { fireEvent, render, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { PluginType } from '@grafana/data';
import { getCatalogPluginMock, getPluginsStateMock } from 'app/features/plugins/admin/__mocks__';
import { CatalogPlugin } from 'app/features/plugins/admin/types';
import { configureStore } from 'app/store/configureStore';

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

const mockCatalogDataSourcePlugin = getCatalogPluginMock({
  type: PluginType.datasource,
  name: 'Sample data source',
  id: 'sample-data-source',
});

describe('Connect Data', () => {
  test('renders no results if the plugins list is empty', async () => {
    renderPage();

    expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();
  });

  test('renders no results if there is no data source plugin in the list', async () => {
    renderPage([getCatalogPluginMock()]);

    expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();
  });

  test('renders only data source plugins when list is populated', async () => {
    renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);

    expect(await screen.findByText('Sample data source')).toBeVisible();
  });

  test('renders card if search term matches', async () => {
    renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);
    const searchField = await screen.findByRole('textbox');

    fireEvent.change(searchField, { target: { value: 'ampl' } });
    expect(await screen.findByText('Sample data source')).toBeVisible();

    fireEvent.change(searchField, { target: { value: 'cramp' } });
    expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();
  });
});
