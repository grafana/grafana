import { render, screen } from 'test/test-utils';

import { TimeRange, dateTime } from '@grafana/data';

import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { EventDetails } from './EventDetails';

// Mock hooks and modules used by EventDetails internals to avoid network/stateful behavior
jest.mock('../../../hooks/useCombinedRule', () => ({
  useCombinedRule: () => ({ error: null, loading: false, result: { annotations: {} } }),
}));

jest.mock('../../../api/stateHistoryApi', () => ({
  stateHistoryApi: {
    useGetRuleHistoryQuery: () => ({ currentData: undefined, isLoading: false, isError: false, error: undefined }),
  },
}));

jest.mock('../state-history/LokiStateHistory', () => ({
  useFrameSubset: () => ({ frameSubset: [], frameTimeRange: undefined }),
}));

describe('EventDetails', () => {
  it('renders error message row when current state is Error', () => {
    const record = {
      timestamp: Date.now(),
      line: {
        previous: GrafanaAlertState.Normal,
        current: GrafanaAlertState.Error,
        error: 'test error message',
        labels: { instance: 'i-123' },
        ruleUID: 'grafana/uid-1',
      },
    };

    const timeRange: TimeRange = {
      from: dateTime(0),
      to: dateTime(1),
      raw: { from: dateTime(0), to: dateTime(1) },
    };

    render(<EventDetails record={record} addFilter={jest.fn()} timeRange={timeRange} />);

    const errorRow = screen.getByTestId('state-history-error');
    expect(errorRow).toBeInTheDocument();
    expect(errorRow).toHaveTextContent('Error message:');
    expect(errorRow).toHaveTextContent('test error message');
  });
});
