import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { PluginType } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { getCatalogPluginMock, getPluginsStateMock } from 'app/features/plugins/admin/__mocks__';
import { CatalogPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types';

import { AddNewConnection } from './ConnectData';

jest.mock('app/features/datasources/api');

const renderPage = (plugins: CatalogPlugin[] = []): RenderResult => {
  return render(
    <TestProvider storeState={{ plugins: getPluginsStateMock(plugins) }}>
      <AddNewConnection />
    </TestProvider>
  );
};

const mockCatalogDataSourcePlugin = getCatalogPluginMock({
  type: PluginType.datasource,
  name: 'Sample data source',
  id: 'sample-data-source',
});

describe('Angular badge', () => {
  test('does not show angular badge for non-angular plugins', async () => {
    renderPage([
      getCatalogPluginMock({
        id: 'react-plugin',
        name: 'React Plugin',
        type: PluginType.datasource,
        angularDetected: false,
      }),
    ]);
    await waitFor(() => {
      expect(screen.queryByText('React Plugin')).toBeInTheDocument();
    });
    expect(screen.queryByText('Angular')).not.toBeInTheDocument();
  });

  test('shows angular badge for angular plugins', async () => {
    renderPage([
      getCatalogPluginMock({
        id: 'legacy-plugin',
        name: 'Legacy Plugin',
        type: PluginType.datasource,
        angularDetected: true,
      }),
    ]);
    await waitFor(() => {
      expect(screen.queryByText('Legacy Plugin')).toBeInTheDocument();
    });
    expect(screen.queryByText('Angular')).toBeInTheDocument();
  });
});

describe('Add new connection', () => {
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

    await userEvent.type(searchField, 'ampl');
    expect(await screen.findByText('Sample data source')).toBeVisible();

    await userEvent.clear(searchField);
    await userEvent.type(searchField, 'cramp');
    expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();

    await userEvent.clear(searchField);
    expect(await screen.findByText('Sample data source')).toBeVisible();
  });

  test('shows a "No access" modal if the user does not have permissions to create datasources', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockImplementation((permission: string) => {
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
    await userEvent.click(await screen.findByText('Sample data source'));
    expect(screen.queryByText(new RegExp(exampleSentenceInModal))).toBeInTheDocument();
  });
});
