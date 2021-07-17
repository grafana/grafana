import React from 'react';

import { DataSourcesListPage } from './DataSourcesListPage';

import { fireEvent, render, screen } from '@testing-library/react';
import { getMockDataSources } from './__mocks__/dataSourcesMocks';

describe('DataSourcesListPage', () => {
  it('Should correctly delete datasource when confirming action', async () => {
    const deleteDataSource = jest.fn();
    const datasources = getMockDataSources(1);

    render(
      <DataSourcesListPage
        dataSources={datasources}
        hasFetched={true}
        navModel={{ main: { text: 'Configuration' }, node: { text: 'Data Sources' } }}
        searchQuery=""
        loadDataSources={jest.fn()}
        deleteDataSource={deleteDataSource}
        setDataSourcesSearchQuery={jest.fn() as any}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);
    const confirmButton = await screen.findByText('Yes');
    fireEvent.click(confirmButton);

    expect(deleteDataSource).toHaveBeenCalledWith(datasources[0].id, true);
    expect(deleteDataSource).toHaveBeenCalledTimes(1);
  });

  it('Should NOT delete datasource when dismissing confirm modal', async () => {
    const deleteDataSource = jest.fn();
    const datasources = getMockDataSources(1);

    render(
      <DataSourcesListPage
        dataSources={datasources}
        hasFetched={true}
        navModel={{ main: { text: 'Configuration' }, node: { text: 'Data Sources' } }}
        searchQuery=""
        loadDataSources={jest.fn()}
        deleteDataSource={deleteDataSource}
        setDataSourcesSearchQuery={jest.fn() as any}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);
    const dismissButton = await screen.findByText('Cancel');
    fireEvent.click(dismissButton);

    expect(deleteDataSource).toHaveBeenCalledTimes(0);
  });
});
