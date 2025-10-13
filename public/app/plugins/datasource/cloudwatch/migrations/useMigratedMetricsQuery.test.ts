import { renderHook } from '@testing-library/react';

import { DEFAULT_METRICS_QUERY } from '../defaultQueries';
import { CloudWatchMetricsQuery } from '../types';

import { migrateAliasPatterns } from './metricQueryMigrations';
import useMigratedMetricsQuery from './useMigratedMetricsQuery';

describe('usePrepareMetricsQuery', () => {
  const DEFAULT_TEST_QUERY: CloudWatchMetricsQuery = { ...DEFAULT_METRICS_QUERY, refId: 'testId' };
  describe('when there is no label', () => {
    const testQuery: CloudWatchMetricsQuery = { ...DEFAULT_TEST_QUERY, alias: 'test' };
    it('should replace label with alias and trigger onChangeQuery', async () => {
      const expectedQuery: CloudWatchMetricsQuery = migrateAliasPatterns(testQuery);
      const onChangeQuery = jest.fn();
      const { result } = renderHook(() => useMigratedMetricsQuery(testQuery, onChangeQuery));
      expect(onChangeQuery).toHaveBeenLastCalledWith(result.current);
      expect(result.current).toEqual(expectedQuery);
    });
  });
  describe('when query has a label', () => {
    const testQuery: CloudWatchMetricsQuery = { ...DEFAULT_TEST_QUERY, label: 'test' };
    it('should not replace label or trigger onChange', async () => {
      const onChangeQuery = jest.fn();
      const { result } = renderHook(() => useMigratedMetricsQuery(testQuery, onChangeQuery));
      expect(result.current).toEqual(testQuery);
      expect(onChangeQuery).toHaveBeenCalledTimes(0);
    });
  });
});
