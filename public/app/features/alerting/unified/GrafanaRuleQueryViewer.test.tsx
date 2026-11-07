import { render, screen, waitFor } from 'test/test-utils';

import { getDataSourceInstanceList } from '@grafana/runtime';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

import { buildDynamicThreshold } from '../../expressions/components/DynamicThreshold/buildDynamicThreshold';
import { type DynamicThresholdPolicyV1 } from '../../expressions/types';
import { EvalFunction } from '../state/alertDef';

import { GrafanaRuleQueryViewer } from './GrafanaRuleQueryViewer';
import { type AlertQueryDataSources } from './hooks/alertQueriesStatus';
import { mockCombinedRule } from './mocks';
import { mimirDataSource } from './mocks/server/configure';

jest.mock('@grafana/sql', () => ({
  Preview: ({ rawSql }: { rawSql: string }) => <pre data-testid="sql-preview" data-raw-sql={rawSql} />,
}));

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

  describe('SQL expressions', () => {
    const sqlExpression = (refId: string, extra: Record<string, unknown> = {}): AlertQuery => ({
      refId,
      datasourceUid: '__expr__',
      queryType: '',
      model: {
        refId,
        type: 'sql',
        datasource: { uid: '__expr__', type: '__expr__' },
        expression: 'SELECT 1 AS generated_marker',
        ...extra,
      } as AlertDataQuery,
    });

    const dynamicThresholdPolicy: DynamicThresholdPolicyV1 = {
      inputRefId: 'A',
      valueField: 'value',
      matchLabel: 'region',
      labelColumns: ['region'],
      evaluator: EvalFunction.IsAbove,
      mappings: [],
      defaultThreshold: [1],
    };

    function compiledSql() {
      const built = buildDynamicThreshold(dynamicThresholdPolicy);
      if (!built.ok) {
        throw new Error('expected the test policy to compile');
      }
      return built.expressionSql;
    }

    it('labels an expression with dynamic threshold metadata and passes the generated SQL to the preview', async () => {
      const dataSources = await dataSourcesPromise;
      const generatedSql = compiledSql();

      render(
        <GrafanaRuleQueryViewer
          queries={[
            sqlExpression('B', {
              expression: generatedSql,
              dynamicThreshold: { version: 1, policy: dynamicThresholdPolicy },
            }),
          ]}
          condition="B"
          rule={mockCombinedRule()}
          dataSourcesByUid={dataSources}
        />
      );

      expect(await screen.findByText('Dynamic threshold')).toBeInTheDocument();
      expect(screen.getByText('Generated SQL')).toBeInTheDocument();
      expect(screen.queryByText('Sql')).not.toBeInTheDocument();
      expect(screen.getByTestId('sql-preview')).toHaveAttribute('data-raw-sql', generatedSql);
    });

    it('renders SQL that no longer matches its dynamic threshold policy as ordinary SQL', async () => {
      const dataSources = await dataSourcesPromise;

      render(
        <GrafanaRuleQueryViewer
          queries={[
            sqlExpression('B', {
              expression: `${compiledSql()} -- edited`,
              dynamicThreshold: { version: 1, policy: dynamicThresholdPolicy },
            }),
          ]}
          condition="B"
          rule={mockCombinedRule()}
          dataSourcesByUid={dataSources}
        />
      );

      expect(await screen.findByText('Sql')).toBeInTheDocument();
      expect(screen.queryByText('Dynamic threshold')).not.toBeInTheDocument();
      expect(screen.queryByText('Generated SQL')).not.toBeInTheDocument();
    });

    it('keeps the ordinary SQL label for SQL without metadata', async () => {
      const dataSources = await dataSourcesPromise;

      render(
        <GrafanaRuleQueryViewer
          queries={[sqlExpression('B')]}
          condition="B"
          rule={mockCombinedRule()}
          dataSourcesByUid={dataSources}
        />
      );

      expect(await screen.findByText('Sql')).toBeInTheDocument();
      expect(screen.queryByText('Dynamic threshold')).not.toBeInTheDocument();
      expect(screen.queryByText('Generated SQL')).not.toBeInTheDocument();
    });
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
