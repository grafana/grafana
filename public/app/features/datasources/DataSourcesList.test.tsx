import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { LayoutModes } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';
import { DataSourcesState } from 'app/types';

import DataSourcesList from './DataSourcesList';
import { getMockDataSources } from './__mocks__/dataSourcesMocks';
import { initialState } from './state/reducers';

const setup = (stateOverride?: Partial<DataSourcesState>) => {
  const store = configureStore({
    dataSources: {
      ...initialState,
      dataSources: getMockDataSources(3),
      layoutMode: LayoutModes.Grid,
      ...stateOverride,
    },
  });

  return render(
    <Provider store={store}>
      <DataSourcesList dataSources={getMockDataSources(3)} />
    </Provider>
  );
};

describe('DataSourcesList', () => {
  it('should render list of datasources', () => {
    setup();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByRole('heading')).toHaveLength(3);
  });

  it('should render all elements in the list item', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'dataSource-0' })).toBeInTheDocument();
  });
});
