import React from 'react';
import { render, screen } from '@testing-library/react';
import DataSourcesList from './DataSourcesList';
import { getMockDataSources } from './__mocks__/dataSourcesMocks';
import { LayoutModes } from '@grafana/data';

const setup = () => {
  const props = {
    dataSources: getMockDataSources(3),
    layoutMode: LayoutModes.Grid,
  };

  return render(<DataSourcesList {...props} />);
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
    expect(screen.getByRole('link', { name: 'dataSource-0 dataSource-0' })).toBeInTheDocument();
    expect(screen.getByAltText('dataSource-0')).toBeInTheDocument();
  });
});
