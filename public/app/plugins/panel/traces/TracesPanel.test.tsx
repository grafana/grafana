import { render, screen } from '@testing-library/react';

import { LoadingState, type PanelProps } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import { TracesPanel } from './TracesPanel';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

jest.mock('app/features/explore/TraceView/TraceView', () => ({
  TraceView: () => <div data-testid="trace-view" />,
}));

jest.mock('app/features/explore/TraceView/utils/transform', () => ({
  transformDataFrames: jest.fn(() => ({ traceID: 'test-trace' })),
}));

const mockGetDataSourceInstance = getDataSourceInstance as jest.Mock;

describe('TracesPanel', () => {
  beforeEach(() => {
    mockGetDataSourceInstance.mockResolvedValue({ uid: 'tempo-uid', type: 'tempo' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows no data message when no data supplied', async () => {
    const props = {
      data: {
        error: undefined,
        series: [],
        state: LoadingState.Done,
      },
    } as unknown as PanelProps;

    render(<TracesPanel {...props} />);

    await screen.findByText('No data found in response');
  });

  it('resolves datasource from data.request when available', async () => {
    const props = {
      data: {
        series: [{ fields: [], length: 0 }],
        state: LoadingState.Done,
        request: {
          targets: [{ datasource: { uid: 'tempo-from-request' } }],
        },
        timeRange: { from: 0, to: 1 },
      },
      options: {},
      replaceVariables: (v: string) => v,
    } as unknown as PanelProps;

    render(<TracesPanel {...props} />);

    await screen.findByTestId('trace-view');

    expect(mockGetDataSourceInstance).toHaveBeenCalledWith('tempo-from-request');
  });

  it('falls back to options.datasource when data.request is undefined', async () => {
    const props = {
      data: {
        series: [{ fields: [], length: 0 }],
        state: LoadingState.Done,
        timeRange: { from: 0, to: 1 },
      },
      options: {
        datasource: { uid: 'tempo-from-options', type: 'tempo' },
      },
      replaceVariables: (v: string) => v,
    } as unknown as PanelProps;

    render(<TracesPanel {...props} />);

    await screen.findByTestId('trace-view');

    expect(mockGetDataSourceInstance).toHaveBeenCalledWith('tempo-from-options');
  });

  it('does not call getDataSourceInstance when no uid is available', async () => {
    const props = {
      data: {
        series: [{ fields: [], length: 0 }],
        state: LoadingState.Done,
        timeRange: { from: 0, to: 1 },
      },
      options: {},
      replaceVariables: (v: string) => v,
    } as unknown as PanelProps;

    render(<TracesPanel {...props} />);

    await screen.findByTestId('trace-view');

    expect(mockGetDataSourceInstance).not.toHaveBeenCalled();
  });
});
