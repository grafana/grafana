import { render, screen } from 'test/test-utils';

import { type DataSourceInstanceSettings, LoadingState } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { TestDataSettings } from 'app/features/query/state/mocks/mockDataSource';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { QueryEditor } from './QueryEditor';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(),
}));

// Stub QueryWrapper — this suite only exercises settings-resolution, not plugin rendering.
jest.mock('./QueryWrapper', () => ({
  ...jest.requireActual('./QueryWrapper'),
  // eslint-disable-next-line react/display-name
  QueryWrapper: () => <div data-testid="query-wrapper" />,
}));

const mockGetDataSourceInstanceSettings = jest.mocked(getDataSourceInstanceSettings);

const query: AlertQuery = {
  refId: 'A',
  datasourceUid: 'test-uid',
  model: { refId: 'A' },
  relativeTimeRange: { from: 600, to: 0 },
};

const defaultProps = {
  panelData: { A: { series: [], state: LoadingState.Done } },
  queries: [query],
  expressions: [],
  onRunQueries: jest.fn(),
  onChangeQueries: jest.fn(),
  onDuplicateQuery: jest.fn(),
  condition: null,
  onSetCondition: jest.fn(),
};

describe('QueryEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading placeholder while data source settings are resolving', () => {
    mockGetDataSourceInstanceSettings.mockReturnValue(new Promise(() => {}));

    render(<QueryEditor {...defaultProps} />);

    expect(screen.getByText(/loading data source/i)).toBeInTheDocument();
    expect(screen.queryByText(/this datasource has been removed/i)).not.toBeInTheDocument();
  });

  it('shows "datasource has been removed" once resolved and the data source is missing', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue(undefined);

    render(<QueryEditor {...defaultProps} />);

    expect(await screen.findByText(/this datasource has been removed/i)).toBeInTheDocument();
  });

  it('renders the resolved query once data source settings are available', async () => {
    const settings: DataSourceInstanceSettings = { ...TestDataSettings, uid: 'test-uid' };
    mockGetDataSourceInstanceSettings.mockResolvedValue(settings);

    render(<QueryEditor {...defaultProps} />);

    expect(await screen.findByTestId('query-wrapper')).toBeInTheDocument();
    expect(screen.queryByText(/this datasource has been removed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/loading data source/i)).not.toBeInTheDocument();
  });
});
