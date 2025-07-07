import { render, screen } from '@testing-library/react';

import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';
import { AzureMonitorOption } from '../../types/types';

import MetricNamespaceField from './MetricNamespaceField';

const props = {
  metricNamespaces: [],
  query: createMockQuery(),
  datasource: createMockDatasource(),
  variableOptionGroup: { label: 'Templates', options: [] },
  onQueryChange: jest.fn(),
  setError: jest.fn(),
};

describe('Azure Monitor QueryEditor', () => {
  it('should render the current value', async () => {
    const metricNamespaces: AzureMonitorOption[] = [{ label: 'foo', value: 'foo' }];
    const query = {
      ...props.query,
      azureMonitor: {
        metricNamespace: 'foo',
      },
    };
    render(<MetricNamespaceField {...props} metricNamespaces={metricNamespaces} query={query} />);
    expect(screen.queryByText('foo')).toBeInTheDocument();
  });

  it('should render the current value even if it is not in the list of options', async () => {
    const metricNamespaces: AzureMonitorOption[] = [{ label: 'foo', value: 'foo' }];
    const query = {
      ...props.query,
      azureMonitor: {
        metricNamespace: 'bar',
      },
    };
    render(<MetricNamespaceField {...props} metricNamespaces={metricNamespaces} query={query} />);
    expect(screen.queryByText('bar')).toBeInTheDocument();
    expect(screen.queryByText('foo')).not.toBeInTheDocument();
  });
});
