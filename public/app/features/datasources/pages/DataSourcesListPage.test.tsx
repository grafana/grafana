import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { LayoutModes } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { navIndex, getMockDataSources } from '../__mocks__';
import { getDataSources } from '../api';
import { initialState } from '../state';

import { DataSourcesListPage } from './DataSourcesListPage';

jest.mock('app/core/services/context_srv');
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  getDataSources: jest.fn().mockResolvedValue([]),
}));

const getDataSourcesMock = getDataSources as jest.Mock;

const setup = (options: { isSortAscending: boolean }) => {
  const store = configureStore({
    dataSources: {
      ...initialState,
      layoutMode: LayoutModes.Grid,
      isSortAscending: options.isSortAscending,
    },
    navIndex,
  });

  return render(
    <Provider store={store}>
      <DataSourcesListPage />
    </Provider>
  );
};

describe('Render', () => {
  beforeEach(() => {
    (contextSrv.hasPermission as jest.Mock) = jest.fn().mockReturnValue(true);
  });

  it('should render component', async () => {
    setup({ isSortAscending: true });

    expect(await screen.findByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Documentation' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Community' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Add new data source' })).toBeInTheDocument();
  });

  it('should not render "Add new data source" button if user has no permissions', async () => {
    (contextSrv.hasPermission as jest.Mock) = jest.fn().mockReturnValue(false);
    setup({ isSortAscending: true });

    expect(await screen.findByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Documentation' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Community' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add new data source' })).toBeNull();
  });

  it('should render action bar and datasources', async () => {
    getDataSourcesMock.mockResolvedValue(getMockDataSources(5));

    setup({ isSortAscending: true });

    expect(await screen.findByPlaceholderText('Search by name or type')).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-1' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-2' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-3' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-4' })).toBeInTheDocument();
    expect(await screen.findAllByRole('img')).toHaveLength(5);
  });

  describe('should render elements in sort order', () => {
    it('ascending', async () => {
      getDataSourcesMock.mockResolvedValue(getMockDataSources(5));
      setup({ isSortAscending: true });

      expect(await screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
      const dataSourceItems = await screen.findAllByRole('heading');

      expect(dataSourceItems).toHaveLength(6);
      expect(dataSourceItems[0]).toHaveTextContent('Configuration');
      expect(dataSourceItems[1]).toHaveTextContent('dataSource-0');
      expect(dataSourceItems[2]).toHaveTextContent('dataSource-1');
    });
    it('descending', async () => {
      getDataSourcesMock.mockResolvedValue(getMockDataSources(5));
      setup({ isSortAscending: false });

      expect(await screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
      const dataSourceItems = await screen.findAllByRole('heading');

      expect(dataSourceItems).toHaveLength(6);
      expect(dataSourceItems[0]).toHaveTextContent('Configuration');
      expect(dataSourceItems[1]).toHaveTextContent('dataSource-4');
      expect(dataSourceItems[2]).toHaveTextContent('dataSource-3');
    });
  });
});
