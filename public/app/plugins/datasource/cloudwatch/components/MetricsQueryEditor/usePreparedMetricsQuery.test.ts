import { renderHook } from '@testing-library/react-hooks';

import { config } from '@grafana/runtime';

import { DEFAULT_METRICS_QUERY } from '../../defaultQueries';
import { migrateAliasPatterns } from '../../migrations/metricQueryMigrations';
import { CloudWatchMetricsQuery } from '../../types';

import usePreparedMetricsQuery from './usePreparedMetricsQuery';

describe('usePrepareMetricsQuery', () => {
  describe('when dynamic labels are true and there is no label', () => {
    config.featureToggles.cloudWatchDynamicLabels = true;
    const testQuery: CloudWatchMetricsQuery = { ...DEFAULT_METRICS_QUERY, alias: 'test' };
    const expectedQuery: CloudWatchMetricsQuery = migrateAliasPatterns(testQuery);
    it('should replace label with alias and trigger onChangeQuery', async () => {
      const onChangeQuery = jest.fn();
      const { result } = renderHook(() => usePreparedMetricsQuery(testQuery, onChangeQuery));
      expect(onChangeQuery).toHaveBeenLastCalledWith(result.current);
      expect(result.current).toEqual(expectedQuery);
    });
  });
  describe('when query has a label', () => {
    config.featureToggles.cloudWatchDynamicLabels = true;
    const testQuery: CloudWatchMetricsQuery = { ...DEFAULT_METRICS_QUERY, label: 'test' };
    it('should not replace label or trigger onChange', async () => {
      const onChangeQuery = jest.fn();
      const { result } = renderHook(() => usePreparedMetricsQuery(testQuery, onChangeQuery));
      expect(result.current).toEqual(testQuery);
      expect(onChangeQuery).toHaveBeenCalledTimes(0);
    });
  });
  describe('when dynamic labels feature flag is disabled', () => {
    config.featureToggles.cloudWatchDynamicLabels = false;
    const testQuery: CloudWatchMetricsQuery = { ...DEFAULT_METRICS_QUERY };
    it('should not replace label or trigger onChange', async () => {
      const onChangeQuery = jest.fn();
      const { result } = renderHook(() => usePreparedMetricsQuery(testQuery, onChangeQuery));
      expect(result.current).toEqual(testQuery);
      expect(onChangeQuery).toHaveBeenCalledTimes(0);
    });
  });
});
