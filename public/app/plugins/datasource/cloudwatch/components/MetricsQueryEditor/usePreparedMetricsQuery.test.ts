import { renderHook } from '@testing-library/react-hooks';

import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType } from '../../types';

import usePreparedMetricsQuery, { DEFAULT_QUERY } from './usePreparedMetricsQuery';

interface TestScenario {
  name: string;
  query: any;
  expectedQuery: CloudWatchMetricsQuery;
}

const baseQuery: CloudWatchMetricsQuery = {
  refId: 'A',
  id: '',
  region: 'us-east-2',
  namespace: 'AWS/EC2',
  dimensions: { InstanceId: 'x-123' },
};

describe('usePrepareMetricsQuery', () => {
  describe('when an incomplete query is provided', () => {
    const testTable: TestScenario[] = [
      { name: 'Empty query', query: { refId: 'A' }, expectedQuery: { ...DEFAULT_QUERY, refId: 'A' } },
      {
        name: 'Match exact is not part of the query',
        query: { ...baseQuery },
        expectedQuery: { ...DEFAULT_QUERY, ...baseQuery, matchExact: true },
      },
      {
        name: 'Match exact is part of the query',
        query: { ...baseQuery, matchExact: false },
        expectedQuery: { ...DEFAULT_QUERY, ...baseQuery, matchExact: false },
      },
      {
        name: 'When editor mode and builder mode different from default is specified',
        query: { ...baseQuery, metricQueryType: MetricQueryType.Query, metricEditorMode: MetricEditorMode.Code },
        expectedQuery: {
          ...DEFAULT_QUERY,
          ...baseQuery,
          metricQueryType: MetricQueryType.Query,
          metricEditorMode: MetricEditorMode.Code,
        },
      },
    ];
    describe.each(testTable)('scenario %#: $name', (scenario) => {
      it('should set the default values and trigger onChangeQuery', async () => {
        const onChangeQuery = jest.fn();
        const { result } = renderHook(() => usePreparedMetricsQuery(scenario.query, onChangeQuery));
        expect(onChangeQuery).toHaveBeenLastCalledWith(result.current);
        expect(result.current).toEqual(scenario.expectedQuery);
      });
    });
  });

  describe('when a complete query is provided', () => {
    it('should not change the query and should not call onChangeQuery', async () => {
      const onChangeQuery = jest.fn();
      const completeQuery: CloudWatchMetricsQuery = {
        ...baseQuery,
        expression: '',
        queryMode: 'Metrics',
        metricName: '',
        statistic: 'Sum',
        period: '300',
        metricQueryType: MetricQueryType.Query,
        metricEditorMode: MetricEditorMode.Code,
        sqlExpression: 'SELECT 1',
        matchExact: false,
      };
      const { result } = renderHook(() => usePreparedMetricsQuery(completeQuery, onChangeQuery));
      expect(onChangeQuery).not.toHaveBeenCalled();
      expect(result.current).toEqual(completeQuery);
    });
  });
});
