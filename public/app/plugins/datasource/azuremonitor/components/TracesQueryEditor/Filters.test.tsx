import { render, screen } from '@testing-library/react';
import React from 'react';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';

import Filters from './Filters';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe(`Traces Filters`, () => {
  const mockDatasource = createMockDatasource();

  it('should render a trace filter', async () => {
    let mockQuery = createMockQuery();
    mockQuery.azureTraces = {
      ...mockQuery.azureTraces,
      filters: [
        {
          filters: ['test-filter'],
          operation: 'eq',
          property: 'test-property',
        },
      ],
    };
    const onQueryChange = jest.fn();
    render(
      <Filters
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={jest.fn()}
      />
    );

    expect(screen.getByText('test-property')).toBeInTheDocument();
    expect(screen.getByText('=')).toBeInTheDocument();
    expect(screen.getByText('test-filter')).toBeInTheDocument();
  });
});
