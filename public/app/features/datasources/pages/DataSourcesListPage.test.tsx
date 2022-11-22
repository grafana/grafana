import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { LayoutModes } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';

import { navIndex, getMockDataSources } from '../__mocks__';
import { getDataSources } from '../api';
import { initialState } from '../state';

import { DataSourcesListPage } from './DataSourcesListPage';

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  getDataSources: jest.fn().mockResolvedValue([]),
}));

const getDataSourcesMock = getDataSources as jest.Mock;

const setup = () => {
  const store = configureStore({
    dataSources: {
      ...initialState,
      layoutMode: LayoutModes.Grid,
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
  it('should render component', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Documentation' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Community' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Add new data source' })).toBeInTheDocument();
  });

  it('should render action bar and datasources', async () => {
    getDataSourcesMock.mockResolvedValue(getMockDataSources(5));

    setup();

    expect(await screen.findByPlaceholderText('Search by name or type')).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-1' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-2' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-3' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'dataSource-4' })).toBeInTheDocument();
    expect(await screen.findAllByRole('img')).toHaveLength(5);
  });
});
