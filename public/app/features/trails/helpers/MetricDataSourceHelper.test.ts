import { PrometheusDatasource } from '@grafana/prometheus';

import { DataTrail } from '../DataTrail';

import { MetricDatasourceHelper } from './MetricDatasourceHelper';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    publicDashboardAccessToken: '123',
  },
}));

const NATIVE_HISTOGRAM = 'test_metric';
describe('MetricDatasourceHelper', () => {
  let metricDatasourceHelper: MetricDatasourceHelper;

  beforeEach(() => {
    const trail = new DataTrail({});
    metricDatasourceHelper = new MetricDatasourceHelper(trail);
    metricDatasourceHelper['_classicHistograms'] = {
      test_metric_bucket: 1,
    };
    const getDatasource = jest.spyOn(MetricDatasourceHelper.prototype as any, 'getDatasource');
    getDatasource.mockImplementation(() => ({} as PrometheusDatasource));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isNativeHistogram', () => {
    it('should return false if metric is not provided', async () => {
      const result = await metricDatasourceHelper.isNativeHistogram('');
      expect(result).toBe(false);
    });

    it('should return true if metric is a native histogram', async () => {
      const result = await metricDatasourceHelper.isNativeHistogram(NATIVE_HISTOGRAM);
      expect(result).toBe(true);
      expect(metricDatasourceHelper['_nativeHistograms']).toContain(NATIVE_HISTOGRAM);
    });

    it('should return false if metric is not a native histogram', async () => {
      const result = await metricDatasourceHelper.isNativeHistogram('non_histogram_metric');
      expect(result).toBe(false);
    });
  });
});
