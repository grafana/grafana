import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getMockDataSources } from '../mocks/dataSourcesMocks';

import { DataSourcesListView } from './DataSourcesList';

const setup = () => {
  return render(
    <DataSourcesListView
      dataSources={getMockDataSources(3)}
      dataSourcesCount={3}
      isLoading={false}
      hasCreateRights={true}
      hasWriteRights={true}
      hasExploreRights={true}
    />
  );
};

describe('<DataSourcesList>', () => {
  it('should render action bar', async () => {
    setup();

    expect(await screen.findByPlaceholderText('Search by name or type')).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
  });

  it('should render list of datasources', async () => {
    setup();

    expect(await screen.findAllByRole('listitem')).toHaveLength(3);
    expect(await screen.findAllByRole('heading')).toHaveLength(3);
    expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(3);
    expect(await screen.findAllByRole('link', { name: 'Explore' })).toHaveLength(3);
  });

  it('should render all elements in the list item', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: 'dataSource-0' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'dataSource-0' })).toBeInTheDocument();
  });
});
