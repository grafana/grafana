import { render, screen } from '@testing-library/react';
import React from 'react';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { AzureMonitorOption } from '../../types';

import TimeGrainField from './TimeGrainField';

const props = {
  timeGrainOptions: [],
  query: createMockQuery(),
  datasource: createMockDatasource(),
  variableOptionGroup: { label: 'Templates', options: [] },
  onQueryChange: jest.fn(),
  setError: jest.fn(),
  isLoading: false,
};

describe('TimeGrainField', () => {
  it('should render the current value', async () => {
    const timeGrainOptions: AzureMonitorOption[] = [{ label: '15m', value: '15m' }];
    const query = {
      ...props.query,
      azureMonitor: {
        timeGrain: '15m',
      },
    };
    render(<TimeGrainField {...props} timeGrainOptions={timeGrainOptions} query={query} />);
    expect(screen.queryByText('15m')).toBeInTheDocument();
  });

  it('should render the current value even if it is not in the list of options', async () => {
    const timeGrainOptions: AzureMonitorOption[] = [{ label: '15m', value: '15m' }];
    const query = {
      ...props.query,
      azureMonitor: {
        timeGrain: '1h',
      },
    };
    render(<TimeGrainField {...props} timeGrainOptions={timeGrainOptions} query={query} />);
    expect(screen.queryByText('1h')).toBeInTheDocument();
    expect(screen.queryByText('15m')).not.toBeInTheDocument();
  });
});
