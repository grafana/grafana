import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { getMockDataSources } from '../__mocks__';

import { DataSourcesListView } from './DataSourcesList';

const setup = () => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <DataSourcesListView
        dataSources={getMockDataSources(3)}
        dataSourcesCount={3}
        isLoading={false}
        hasCreateRights={true}
      />
    </Provider>
  );
};

describe('<DataSourcesList>', () => {
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
