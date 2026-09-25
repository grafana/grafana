import { render, screen, waitFor } from 'test/test-utils';

import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

import { GrafanaRuleQueryViewer } from './GrafanaRuleQueryViewer';
import { type AlertQueryDataSources } from './hooks/alertQueriesStatus';
import { mockCombinedRule } from './mocks';
import { mimirDataSource } from './mocks/server/configure';

const { dataSource } = mimirDataSource();
const DS_UID = dataSource.uid;
setDataSourceInstanceSettings({ [dataSource.name]: dataSource });

const dataSourcesPromise: Promise<AlertQueryDataSources> = getDataSourceInstanceList({ all: true }).then(
  (items) => new Map(items.map((item) => [item.uid, item]))
);

afterAll(() => {
  setDataSourceInstanceSettings({});
});

describe('GrafanaRuleQueryViewer', () => {
  it('renders without crashing', async () => {
    const dataSources = await dataSourcesPromise;
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
    const dataSources = await dataSourcesPromise;
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
    const dataSources = await dataSourcesPromise;
    const rule = mockCombinedRule();

    render(
      <GrafanaRuleQueryViewer
        queries={[getDataSourceQuery('A')]}
        condition="A"
        rule={rule}
        dataSourcesByUid={dataSources}
      />
    );

    expect(await screen.findByText(dataSource.name)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: dataSource.name })).toBeInTheDocument();
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
    expect(screen.queryByText(dataSource.name)).not.toBeInTheDocument();
    expect(screen.queryByText(/refId: A/)).not.toBeInTheDocument();
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
