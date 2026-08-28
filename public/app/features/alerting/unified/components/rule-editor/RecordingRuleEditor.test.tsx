import { render, screen } from 'test/test-utils';

import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import * as runtimeUnstable from '@grafana/runtime/unstable';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { RecordingRuleEditor, type RecordingRuleEditorProps } from './RecordingRuleEditor';

jest.mock('./VizWrapper', () => ({
  VizWrapper: () => <div data-testid="viz-wrapper" />,
}));

const DATASOURCE_NAME = 'My Loki';
const DATASOURCE_UID = 'loki-uid';

const QUERY: AlertQuery = {
  refId: 'A',
  datasourceUid: DATASOURCE_UID,
  queryType: '',
  model: { refId: 'A', expr: 'up' },
};

function renderEditor(props: Partial<RecordingRuleEditorProps> = {}) {
  return render(
    <RecordingRuleEditor
      queries={[QUERY]}
      onChangeQuery={jest.fn()}
      runQueries={jest.fn()}
      panelData={{}}
      dataSourceName={DATASOURCE_NAME}
      {...props}
    />
  );
}

describe('RecordingRuleEditor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing while the data source instance is still loading', () => {
    jest.spyOn(runtimeUnstable, 'useDataSourceInstance').mockReturnValue({ isLoading: true });
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({ isLoading: true });

    const { container } = renderEditor();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows an error message when the resolved data source has no query editor component', () => {
    jest.spyOn(runtimeUnstable, 'useDataSourceInstance').mockReturnValue({
      isLoading: false,
      dataSource: {
        name: DATASOURCE_NAME,
        uid: DATASOURCE_UID,
        type: 'loki',
        components: {},
      } as unknown as DataSourceApi,
    });
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({
      isLoading: false,
      settings: { name: DATASOURCE_NAME, uid: DATASOURCE_UID, type: 'loki' } as unknown as DataSourceInstanceSettings,
    });

    const { container } = renderEditor();

    expect(container).toHaveTextContent(
      'Could not load query editor due to: Data source plugin does not export any Query Editor component'
    );
  });

  it('renders the query editor with the first query once the data source resolves', () => {
    const QueryEditor = jest.fn(() => <div data-testid="query-editor" />);
    jest.spyOn(runtimeUnstable, 'useDataSourceInstance').mockReturnValue({
      isLoading: false,
      dataSource: {
        name: DATASOURCE_NAME,
        uid: DATASOURCE_UID,
        type: 'loki',
        components: { QueryEditor },
      } as unknown as DataSourceApi,
    });
    jest.spyOn(runtimeUnstable, 'useDataSourceInstanceSettings').mockReturnValue({
      isLoading: false,
      settings: { name: DATASOURCE_NAME, uid: DATASOURCE_UID, type: 'loki' } as unknown as DataSourceInstanceSettings,
    });

    renderEditor();

    expect(screen.getByTestId('query-editor')).toBeInTheDocument();
    const [props] = QueryEditor.mock.calls[0];
    expect(props).toMatchObject({ query: QUERY, queries: [QUERY] });
  });
});
