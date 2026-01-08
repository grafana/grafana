import { render, screen } from '@testing-library/react';

import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';
import { AzureMonitorOption } from '../../types/types';

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
