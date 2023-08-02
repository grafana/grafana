import { renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';

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
    config.featureToggles.cloudWatchDynamicLabels = true;
    const testQuery: CloudWatchMetricsQuery = { ...DEFAULT_TEST_QUERY, label: 'test' };
    it('should not replace label or trigger onChange', async () => {
      const onChangeQuery = jest.fn();
      const { result } = renderHook(() => useMigratedMetricsQuery(testQuery, onChangeQuery));
      expect(result.current).toEqual(testQuery);
      expect(onChangeQuery).toHaveBeenCalledTimes(0);
    });
  });
  // TODO: delete this test when dynamic labels feature flag is removed
  describe('when dynamic labels feature flag is disabled', () => {
    const testQuery: CloudWatchMetricsQuery = { ...DEFAULT_TEST_QUERY };
    it('should replace label or trigger onChange', async () => {
      const expectedQuery: CloudWatchMetricsQuery = migrateAliasPatterns(testQuery);
      config.featureToggles.cloudWatchDynamicLabels = false;
      const onChangeQuery = jest.fn();
      const { result } = renderHook(() => useMigratedMetricsQuery(testQuery, onChangeQuery));
      expect(onChangeQuery).toHaveBeenLastCalledWith(result.current);
      expect(result.current).toEqual(expectedQuery);
    });
  });
});
