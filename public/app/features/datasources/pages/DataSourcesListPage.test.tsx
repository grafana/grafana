import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { DataSourceSettings, LayoutModes } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';
import { DataSourcesState } from 'app/types';

import { navIndex, getMockDataSources } from '../__mocks__';
import { initialState } from '../state';

import { DataSourcesListPage } from './DataSourcesListPage';

jest.mock('app/core/services/backend_srv', () => ({
  ...jest.requireActual('app/core/services/backend_srv'),
  getBackendSrv: () => ({ get: jest.fn().mockResolvedValue([]) }),
}));

const setup = (stateOverride?: Partial<DataSourcesState>) => {
  const store = configureStore({
    dataSources: {
      ...initialState,
      dataSources: [] as DataSourceSettings[],
      layoutMode: LayoutModes.Grid,
      hasFetched: false,
      ...stateOverride,
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
  it('should render component', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Documentation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Community' })).toBeInTheDocument();
  });

  it('should render action bar and datasources', () => {
    setup({
      dataSources: getMockDataSources(5),
      dataSourcesCount: 5,
      hasFetched: true,
    });

    expect(screen.getByRole('link', { name: 'Add data source' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'dataSource-1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'dataSource-2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'dataSource-3' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'dataSource-4' })).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(5);
  });
});
