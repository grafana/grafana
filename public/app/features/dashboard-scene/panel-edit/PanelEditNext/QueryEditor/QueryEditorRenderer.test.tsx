import { render, screen } from '@testing-library/react';
import { useState } from 'react';

import { DataSourceApi, DataSourceJsonData } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../constants';

import { QueryEditorProvider } from './QueryEditorContext';
import { QueryEditorRenderer } from './QueryEditorRenderer';
import {
  ds1SettingsMock,
  mockActions,
  mockQueryOptionsState,
  mockTransformToggles,
  renderWithQueryEditorProvider,
} from './testUtils';

jest.mock('app/features/query/components/QueryEditorRow', () => ({
  filterPanelDataToQuery: jest.fn(() => undefined),
}));

jest.mock('app/features/query/components/QueryErrorAlert', () => ({
  QueryErrorAlert: () => null,
}));

interface TestQuery extends DataQuery {
  legendFormat?: string;
}

// Fake query editor that simulates an uncontrolled input — it initialises its
// display value from props.query on mount and never syncs again.
function UncontrolledQueryEditor({ query }: { query: TestQuery }) {
  const [legend] = useState(query.legendFormat ?? '');
  return <div data-testid="query-editor-legend">{legend}</div>;
}

const mockDatasource: Partial<DataSourceApi<DataQuery, DataSourceJsonData>> = {
  components: { QueryEditor: UncontrolledQueryEditor },
};

const selectedQueryDsData = {
  datasource: mockDatasource as DataSourceApi,
  dsSettings: ds1SettingsMock,
};

const queryA: TestQuery = { refId: 'A', legendFormat: 'series-a' };
const queryB: TestQuery = { refId: 'B', legendFormat: 'series-b' };

function renderRenderer(
  selectedQuery: DataQuery | null,
  uiStateOverrides: NonNullable<Parameters<typeof renderWithQueryEditorProvider>[1]>['uiStateOverrides'] = {}
) {
  return renderWithQueryEditorProvider(<QueryEditorRenderer />, {
    queries: [queryA, queryB],
    selectedQuery,
    uiStateOverrides: { selectedQueryDsData, ...uiStateOverrides },
  });
}

describe('QueryEditorRenderer', () => {
  it('renders nothing when no query is selected', () => {
    renderRenderer(null);
    expect(screen.queryByTestId('query-editor-legend')).not.toBeInTheDocument();
  });

  it('shows a loading spinner while the datasource is loading', () => {
    renderRenderer(queryA, { selectedQueryDsLoading: true, selectedQueryDsData: null });
    expect(screen.getByText(/loading datasource/i)).toBeInTheDocument();
  });

  it('shows an error when the datasource fails to load', () => {
    renderRenderer(queryA, { selectedQueryDsData: null });
    expect(screen.getByText(/failed to load datasource for this query/i)).toBeInTheDocument();
  });

  it('renders the query editor for the selected query', () => {
    renderRenderer(queryA);
    expect(screen.getByTestId('query-editor-legend')).toHaveTextContent('series-a');
  });

  it('remounts the query editor when switching queries, resetting uncontrolled input state', () => {
    // Regression test: datasource plugin editors (e.g. Loki) use uncontrolled
    // inputs (defaultValue) for options like Legend. Without a `key` prop on
    // the QueryEditorComponent, React reuses the mounted instance when
    // switching queries and the DOM values stay stale from the previous query.
    //
    // Example: user edits Legend on query A → "foo", switches to query B which
    // has legendFormat "bar" — without the fix the Legend field still shows "foo".

    // RTL's rerender requires a full ReactElement, so we construct the provider
    // tree directly here rather than going through renderWithQueryEditorProvider.
    function buildJsx(selectedQuery: DataQuery) {
      return (
        <QueryEditorProvider
          dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
          qrState={{ queries: [queryA, queryB], data: undefined, isLoading: false, queryError: undefined }}
          panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [] }}
          alertingState={{ alertRules: [], loading: false, isDashboardSaved: true }}
          uiState={{
            selectedQuery,
            selectedTransformation: null,
            selectedAlert: null,
            setSelectedQuery: jest.fn(),
            setSelectedTransformation: jest.fn(),
            setSelectedAlert: jest.fn(),
            queryOptions: mockQueryOptionsState,
            selectedQueryDsData,
            selectedQueryDsLoading: false,
            showingDatasourceHelp: false,
            toggleDatasourceHelp: jest.fn(),
            transformToggles: mockTransformToggles,
            cardType: QueryEditorType.Query,
            pendingExpression: null,
            setPendingExpression: jest.fn(),
            finalizePendingExpression: jest.fn(),
            pendingTransformation: null,
            setPendingTransformation: jest.fn(),
            finalizePendingTransformation: jest.fn(),
          }}
          actions={mockActions}
        >
          <QueryEditorRenderer />
        </QueryEditorProvider>
      );
    }

    const { rerender } = render(buildJsx(queryA));
    expect(screen.getByTestId('query-editor-legend')).toHaveTextContent('series-a');

    rerender(buildJsx(queryB));

    // Must show series-b, not the stale series-a value from query A's editor instance
    expect(screen.getByTestId('query-editor-legend')).toHaveTextContent('series-b');
  });
});
