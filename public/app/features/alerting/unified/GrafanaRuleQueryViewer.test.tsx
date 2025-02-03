import { render, screen, waitFor } from 'test/test-utils';

import { DataSourceRef } from '@grafana/schema';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { GrafanaRuleQueryViewer } from './GrafanaRuleQueryViewer';
import { mockCombinedRule } from './mocks';

describe('GrafanaRuleQueryViewer', () => {
  it('renders without crashing', async () => {
    const rule = mockCombinedRule();

    const getDataSourceQuery = (sourceRefId: string, targetRefId = '') => {
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
          expression: targetRefId,
        },
      };
      return query;
    };
    const queries = [
      getDataSourceQuery('A'),
      getDataSourceQuery('B', 'A'),
      getDataSourceQuery('C', 'A'),
      getDataSourceQuery('D', 'A'),
      getDataSourceQuery('E', 'A'),
    ];

    const getExpression = (refId: string, dsRef: DataSourceRef, targetRefId: string) => {
      const expr = {
        refId: refId,
        datasourceUid: '__expr__',
        queryType: '',
        model: {
          refId: refId,
          type: 'classic_conditions',
          datasource: dsRef,
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
                params: [targetRefId],
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
    };

    const expressions = [
      getExpression('F', { type: '' }, 'A'),
      getExpression('G', { type: '' }, 'A'),
      getExpression('H', { type: '' }, 'A'),
      getExpression('I', { type: '' }, 'A'),
    ];
    render(<GrafanaRuleQueryViewer queries={[...queries, ...expressions]} condition="A" rule={rule} />);

    await waitFor(() => expect(screen.getByTestId('queries-container')).toHaveStyle('flex-wrap: wrap'));
    expect(screen.getByTestId('expressions-container')).toHaveStyle('flex-wrap: wrap');
  });
});
