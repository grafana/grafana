import { render, screen, waitFor } from 'test/test-utils';

import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { GrafanaRuleQueryViewer } from './GrafanaRuleQueryViewer';
import { mockCombinedRule } from './mocks';

describe('GrafanaRuleQueryViewer', () => {
  it('renders without crashing', async () => {
    const rule = mockCombinedRule();

    const expressions = [getExpression('F'), getExpression('G'), getExpression('H'), getExpression('I')];
    render(<GrafanaRuleQueryViewer queries={[...queries, ...expressions]} condition="A" rule={rule} />);

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
    render(<GrafanaRuleQueryViewer queries={queries} condition="A" rule={rule} />);
  });
});

function getDataSourceQuery(sourceRefId: string) {
  const query: AlertQuery<AlertDataQuery> = {
    refId: sourceRefId,
    datasourceUid: 'abc123',
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
