import { render, screen } from '@testing-library/react';
import React from 'react';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { AzureMonitorOption } from '../../types';

import AggregationField from './AggregationField';

const props = {
  aggregationOptions: [],
  query: createMockQuery(),
  datasource: createMockDatasource(),
  variableOptionGroup: { label: 'Templates', options: [] },
  onQueryChange: jest.fn(),
  setError: jest.fn(),
  isLoading: false,
};

describe('AggregationField', () => {
  it('should render the current value', async () => {
    const aggregationOptions: AzureMonitorOption[] = [{ label: 'foo', value: 'foo' }];
    const query = {
      ...props.query,
      azureMonitor: {
        aggregation: 'foo',
      },
    };
    render(<AggregationField {...props} aggregationOptions={aggregationOptions} query={query} />);
    expect(screen.queryByText('foo')).toBeInTheDocument();
  });

  it('should render the current value even if it is not in the list of options', async () => {
    const aggregationOptions: AzureMonitorOption[] = [{ label: 'foo', value: 'foo' }];
    const query = {
      ...props.query,
      azureMonitor: {
        aggregation: 'bar',
      },
    };
    render(<AggregationField {...props} aggregationOptions={aggregationOptions} query={query} />);
    expect(screen.queryByText('bar')).toBeInTheDocument();
    expect(screen.queryByText('foo')).not.toBeInTheDocument();
  });
});
