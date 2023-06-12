import { fireEvent, render, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { PluginType } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { getCatalogPluginMock, getPluginsStateMock } from 'app/features/plugins/admin/__mocks__';
import { CatalogPlugin } from 'app/features/plugins/admin/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';

import { AddNewConnection } from './ConnectData';

jest.mock('app/features/datasources/api');

const renderPage = (plugins: CatalogPlugin[] = []): RenderResult => {
  // @ts-ignore
  const store = configureStore({ plugins: getPluginsStateMock(plugins) });

  return render(
    <Provider store={store}>
      <AddNewConnection />
    </Provider>
  );
};

const mockCatalogDataSourcePlugin = getCatalogPluginMock({
  type: PluginType.datasource,
  name: 'Sample data source',
  id: 'sample-data-source',
});

const originalHasPermission = contextSrv.hasPermission;

describe('Add new connection', () => {
  beforeEach(() => {
    contextSrv.hasPermission = originalHasPermission;
  });

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

  test('shows a "No access" modal if the user does not have permissions to create datasources', async () => {
    (contextSrv.hasPermission as jest.Mock) = jest.fn().mockImplementation((permission: string) => {
      if (permission === AccessControlAction.DataSourcesCreate) {
        return false;
      }

      return true;
    });

    renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);
    const exampleSentenceInModal = 'Editors cannot add new connections.';

    // Should not show the modal by default
    expect(screen.queryByText(new RegExp(exampleSentenceInModal))).not.toBeInTheDocument();

    // Should show the modal if the user has no permissions
    fireEvent.click(await screen.findByText('Sample data source'));
    expect(screen.queryByText(new RegExp(exampleSentenceInModal))).toBeInTheDocument();
  });

  test('does not show a "No access" modal but displays the details page if the user has the right permissions', async () => {
    (contextSrv.hasPermission as jest.Mock) = jest.fn().mockReturnValue(true);

    renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);
    const exampleSentenceInModal = 'Editors cannot add new connections.';

    // Should not show the modal by default
    expect(screen.queryByText(new RegExp(exampleSentenceInModal))).not.toBeInTheDocument();

    // Should not show the modal when clicking a card
    fireEvent.click(await screen.findByText('Sample data source'));
    expect(screen.queryByText(new RegExp(exampleSentenceInModal))).not.toBeInTheDocument();
  });
});
