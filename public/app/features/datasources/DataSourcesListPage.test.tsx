import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataSourceSettings, NavModel, LayoutModes } from '@grafana/data';

import { DataSourcesListPage, Props } from './DataSourcesListPage';
import { getMockDataSources } from './__mocks__/dataSourcesMocks';
import { setDataSourcesLayoutMode, setDataSourcesSearchQuery } from './state/reducers';

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      hasPermission: () => true,
    },
  };
});

const setup = (propOverrides?: object) => {
  const props: Props = {
    dataSources: [] as DataSourceSettings[],
    layoutMode: LayoutModes.Grid,
    loadDataSources: jest.fn(),
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Data Sources',
      },
    } as NavModel,
    dataSourcesCount: 0,
    searchQuery: '',
    setDataSourcesSearchQuery,
    setDataSourcesLayoutMode,
    hasFetched: false,
  };

  Object.assign(props, propOverrides);

  return render(<DataSourcesListPage {...props} />);
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
