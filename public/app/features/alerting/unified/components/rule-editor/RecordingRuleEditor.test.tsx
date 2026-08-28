import { render, screen } from 'test/test-utils';

import { type DataSourceApi, type DataSourceInstanceSettings, LoadingState } from '@grafana/data';
import { useDataSourceInstance, useDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { RecordingRuleEditor, type RecordingRuleEditorProps } from './RecordingRuleEditor';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstance: jest.fn(),
  useDataSourceInstanceSettings: jest.fn(),
}));

const mockUseDataSourceInstance = jest.mocked(useDataSourceInstance);
const mockUseDataSourceInstanceSettings = jest.mocked(useDataSourceInstanceSettings);

const defaultProps: RecordingRuleEditorProps = {
  queries: [
    {
      refId: 'A',
      datasourceUid: 'loki',
      model: { refId: 'A', expr: 'count_over_time({job="test"}[5m])' },
      relativeTimeRange: { from: 600, to: 0 },
    },
  ],
  onChangeQuery: jest.fn(),
  runQueries: jest.fn(),
  panelData: { A: { series: [], state: LoadingState.Done } },
  dataSourceName: 'loki',
};

describe('RecordingRuleEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing while the data source is resolving', () => {
    mockUseDataSourceInstance.mockReturnValue({ isLoading: true });
    mockUseDataSourceInstanceSettings.mockReturnValue({ isLoading: true });

    const { container } = render(<RecordingRuleEditor {...defaultProps} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows an error message when the data source has no query editor', () => {
    mockUseDataSourceInstance.mockReturnValue({
      isLoading: false,
      dataSource: { name: 'loki', components: {} } as DataSourceApi,
    });
    mockUseDataSourceInstanceSettings.mockReturnValue({
      isLoading: false,
      settings: { type: 'loki' } as DataSourceInstanceSettings,
    });

    render(<RecordingRuleEditor {...defaultProps} />);

    expect(screen.getByText(/could not load query editor/i)).toBeInTheDocument();
  });

  it('renders the plugin query editor once the data source has resolved', () => {
    const QueryEditor = () => <div data-testid="plugin-query-editor" />;
    mockUseDataSourceInstance.mockReturnValue({
      isLoading: false,
      dataSource: { name: 'loki', uid: 'loki', type: 'loki', components: { QueryEditor } } as unknown as DataSourceApi,
    });
    mockUseDataSourceInstanceSettings.mockReturnValue({
      isLoading: false,
      settings: { type: 'loki' } as DataSourceInstanceSettings,
    });

    render(<RecordingRuleEditor {...defaultProps} />);

    expect(screen.getByTestId('plugin-query-editor')).toBeInTheDocument();
  });
});
