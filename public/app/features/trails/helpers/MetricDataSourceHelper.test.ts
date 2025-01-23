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
    });

    it('should return false if metric is not a native histogram', async () => {
      const result = await metricDatasourceHelper.isNativeHistogram('non_histogram_metric');
      expect(result).toBe(false);
    });

    it('should return false if metric is a classic histogram', async () => {
      const result = await metricDatasourceHelper.isNativeHistogram('test_metric_bucket');
      expect(result).toBe(false);
    });

    it('should return true if metric is a native histogram and has metadata but does not have a classic histogram to compare to', async () => {
      metricDatasourceHelper._metricsMetadata = {
        solo_native_histogram: {
          type: 'histogram',
          help: 'test',
        },
      };
      const result = await metricDatasourceHelper.isNativeHistogram('solo_native_histogram');
      expect(result).toBe(true);
    });
  });
});
