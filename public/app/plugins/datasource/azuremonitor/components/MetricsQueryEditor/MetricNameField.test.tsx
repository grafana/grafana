import { render, screen } from '@testing-library/react';
import React from 'react';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { AzureMonitorOption } from '../../types';

import MetricNameField from './MetricNameField';

const props = {
  metricNames: [],
  query: createMockQuery(),
  datasource: createMockDatasource(),
  variableOptionGroup: { label: 'Templates', options: [] },
  onQueryChange: jest.fn(),
  setError: jest.fn(),
};

describe('MetricNameField', () => {
  it('should render the current value', async () => {
    const metricNames: AzureMonitorOption[] = [{ label: 'foo', value: 'foo' }];
    const query = {
      ...props.query,
      azureMonitor: {
        metricName: 'foo',
      },
    };
    render(<MetricNameField {...props} metricNames={metricNames} query={query} />);
    expect(screen.queryByText('foo')).toBeInTheDocument();
  });

  it('should render the current value even if it is not in the list of options', async () => {
    const metricNames: AzureMonitorOption[] = [{ label: 'foo', value: 'foo' }];
    const query = {
      ...props.query,
      azureMonitor: {
        metricName: 'bar',
      },
    };
    render(<MetricNameField {...props} metricNames={metricNames} query={query} />);
    expect(screen.queryByText('bar')).toBeInTheDocument();
    expect(screen.queryByText('foo')).not.toBeInTheDocument();
  });
});
