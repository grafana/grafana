import { render, screen, waitFor } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

import { GrafanaRuleQueryViewer } from './GrafanaRuleQueryViewer';
import { type AlertQueryDataSources } from './hooks/alertQueriesStatus';
import { mockCombinedRule, mockDataSource } from './mocks';

const DS_UID = 'abc123';

function mockDataSourceListItem(partial: Partial<DataSourceInstanceListItem> = {}): DataSourceInstanceListItem {
  return { isDefault: false, ...mockDataSource(), ...partial };
}

function makeDataSources(...items: DataSourceInstanceListItem[]): AlertQueryDataSources {
  return new Map(items.map((item) => [item.uid, item]));
}

const dataSources = makeDataSources(mockDataSourceListItem({ uid: DS_UID, name: 'Test DS' }));

describe('GrafanaRuleQueryViewer', () => {
  it('renders without crashing', async () => {
    const rule = mockCombinedRule();

    const expressions = [getExpression('F'), getExpression('G'), getExpression('H'), getExpression('I')];
    render(
      <GrafanaRuleQueryViewer
        queries={[...queries, ...expressions]}
        condition="A"
        rule={rule}
        dataSourcesByUid={dataSources}
      />
    );

    await waitFor(() => expect(screen.getByTestId('queries-container')).toHaveStyle('flex-wrap: wrap'));
    expect(screen.getByTestId('expressions-container')).toHaveStyle('flex-wrap: wrap');
  });

  it('should catch cyclical references', async () => {
    const rule = mockCombinedRule();

    const queries = [
      getExpression('A'), // this always points to A
    ];

    jest.spyOn(console, 'error').mockImplementation((message) => {
      expect(message).toMatch(/Failed to parse thresholds/i);
    });
    render(<GrafanaRuleQueryViewer queries={queries} condition="A" rule={rule} dataSourcesByUid={dataSources} />);
  });

  it('renders the data source badge and the query model for a resolved data source', async () => {
    const rule = mockCombinedRule();

    render(
      <GrafanaRuleQueryViewer
        queries={[getDataSourceQuery('A')]}
        condition="A"
        rule={rule}
        dataSourcesByUid={dataSources}
      />
    );

    expect(await screen.findByText('Test DS')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Test DS' })).toBeInTheDocument();
    expect(screen.getByText(/refId: A/)).toBeInTheDocument();
  });

  it('renders neither badge nor query model when the data source did not resolve', async () => {
    const rule = mockCombinedRule();

    render(
      <GrafanaRuleQueryViewer
        queries={[getDataSourceQuery('A')]}
        condition="A"
        rule={rule}
        dataSourcesByUid={new Map()}
      />
    );

    expect(await screen.findByTestId('queries-container')).toBeInTheDocument();
    expect(screen.queryByText('Test DS')).not.toBeInTheDocument();
    expect(screen.queryByText(/refId: A/)).not.toBeInTheDocument();
  });

  it('shows a loading bar instead of the queries while the data sources resolve', async () => {
    const rule = mockCombinedRule();

    // No expressions in this rule, so the only loading bar that can render is the one for the
    // unresolved data sources.
    const { rerender } = render(
      <GrafanaRuleQueryViewer
        queries={[getDataSourceQuery('A')]}
        condition="A"
        rule={rule}
        dataSourcesByUid={new Map()}
        dataSourcesLoading
      />
    );

    expect(await screen.findByTestId('eval-loading-bar')).toBeInTheDocument();
    expect(screen.queryByText('Test DS')).not.toBeInTheDocument();

    rerender(
      <GrafanaRuleQueryViewer
        queries={[getDataSourceQuery('A')]}
        condition="A"
        rule={rule}
        dataSourcesByUid={dataSources}
      />
    );

    expect(await screen.findByText('Test DS')).toBeInTheDocument();
    expect(screen.queryByTestId('eval-loading-bar')).not.toBeInTheDocument();
  });
});

function getDataSourceQuery(sourceRefId: string) {
  const query: AlertQuery<AlertDataQuery> = {
    refId: sourceRefId,
    datasourceUid: DS_UID,
    queryType: '',
    relativeTimeRange: {
      from: 600,
      to: 0,
    },
    model: {
      refId: sourceRefId,
    },
  };
  return query;
}
const queries = [
  getDataSourceQuery('A'),
  getDataSourceQuery('B'),
  getDataSourceQuery('C'),
  getDataSourceQuery('D'),
  getDataSourceQuery('E'),
];

function getExpression(refId: string) {
  const expr = {
    refId: refId,
    datasourceUid: '__expr__',
    queryType: '',
    model: {
      refId: refId,
      type: 'classic_conditions',
      datasource: { type: '' },
      conditions: [
        {
          type: 'query',
          evaluator: {
            params: [3],
            type: 'gt',
          },
          operator: {
            type: 'and',
          },
          query: {
            params: ['A'],
          },
          reducer: {
            params: [],
            type: 'last',
          },
        },
      ],
    },
  };
  return expr;
}
