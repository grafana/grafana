import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { LayoutModes } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

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
  const storeState = {
    dataSources: {
      ...initialState,
      layoutMode: LayoutModes.Grid,
      isSortAscending: options.isSortAscending,
    },
    navIndex,
  };

  return render(
    <TestProvider storeState={storeState}>
      <DataSourcesListPage />
    </TestProvider>
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
    expect(await screen.findByRole('link', { name: 'Add data source' })).toBeInTheDocument();

    // Should not show button in page header when the list is empty
    expect(await screen.queryByRole('link', { name: 'Add new data source' })).toBeNull();
  });

  describe('when user has no permissions', () => {
    beforeEach(() => {
      (contextSrv.hasPermission as jest.Mock) = jest.fn().mockReturnValue(false);
    });

    it('should disable the "Add data source" button if user has no permissions', async () => {
      setup({ isSortAscending: true });

      expect(await screen.findByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: 'Documentation' })).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: 'Support' })).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: 'Community' })).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: 'Add data source' })).toHaveStyle('pointer-events: none');
    });

    it('should not show the Explore button', async () => {
      getDataSourcesMock.mockResolvedValue(getMockDataSources(3));
      setup({ isSortAscending: true });

      expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(3);
      expect(screen.queryAllByRole('link', { name: 'Explore' })).toHaveLength(0);
    });

    it('should not link cards to edit pages', async () => {
      getDataSourcesMock.mockResolvedValue(getMockDataSources(1));
      setup({ isSortAscending: true });

      expect(await screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
      expect(await screen.queryByRole('link', { name: 'dataSource-0' })).toBeNull();
    });
  });

  it('should show the Explore button', async () => {
    getDataSourcesMock.mockResolvedValue(getMockDataSources(3));
    setup({ isSortAscending: true });

    expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(3);
    expect(screen.queryAllByRole('link', { name: 'Explore' })).toHaveLength(3);
  });

  it('should link cards to edit pages', async () => {
    getDataSourcesMock.mockResolvedValue(getMockDataSources(1));
    setup({ isSortAscending: true });

    expect(await screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'dataSource-0' })).toBeInTheDocument();
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

    // Should show button in page header when the list is not empty
    expect(await screen.findByRole('link', { name: 'Add new data source' })).toBeInTheDocument();
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
