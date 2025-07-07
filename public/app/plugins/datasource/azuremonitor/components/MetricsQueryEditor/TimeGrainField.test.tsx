import { render, screen } from '@testing-library/react';

import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';
import { AzureMonitorOption } from '../../types/types';

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
