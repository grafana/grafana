import { getDefaultTimeRange, TimeRange } from '@grafana/data';

import { PrometheusDatasource } from './datasource';
import { PrometheusMetricFindQuery } from './metric_find_query';

jest.mock('./datasource');

describe('PrometheusMetricFindQuery', () => {
  let datasource: jest.Mocked<PrometheusDatasource>;
  let timeRange: TimeRange;

  beforeEach(() => {
    datasource = {
      metadataRequest: jest.fn(),
      languageProvider: {
        start: jest.fn(),
        queryLabelKeys: jest.fn().mockResolvedValue([]),
        queryLabelValues: jest.fn().mockResolvedValue([]),
      },
      getTagKeys: jest.fn(),
    } as unknown as jest.Mocked<PrometheusDatasource>;

    timeRange = getDefaultTimeRange();
  });

  describe('Label Names Query', () => {
    it('should call getTagKeys for simple label_names query', async () => {
      const expectedLabelNames = [{ text: 'label1' }, { text: 'label2' }, { text: 'label3' }];
      datasource.getTagKeys.mockResolvedValue(expectedLabelNames);

      const query = new PrometheusMetricFindQuery(datasource, 'label_names()');
      const results = await query.process(timeRange);

      expect(results).toEqual(expectedLabelNames);
      expect(datasource.getTagKeys).toHaveBeenCalledWith({ filters: [], timeRange });
    });

    it('should call queryLabelKeys with correct parameters', async () => {
      const query = new PrometheusMetricFindQuery(datasource, 'label_names(metric_name) ');
      await query.process(timeRange);
      expect(datasource.languageProvider.queryLabelKeys).toHaveBeenCalledWith(
        timeRange,
        '{__name__=~".*metric_name.*"}'
      );
    });
  });

  describe('Label Values Query', () => {
    it('should call queryLabelValues with correct parameters without metric filter', async () => {
      const query = new PrometheusMetricFindQuery(datasource, 'label_values(label1)');
      await query.process(timeRange);

      expect(datasource.languageProvider.queryLabelValues).toHaveBeenCalledWith(timeRange, 'label1', undefined);
    });

    it('should call queryLabelValues with correct parameters with metric filter', async () => {
      const query = new PrometheusMetricFindQuery(datasource, 'label_values(metric{label="value"}, label1)');
      await query.process(timeRange);

      expect(datasource.languageProvider.queryLabelValues).toHaveBeenCalledWith(
        timeRange,
        'label1',
        'metric{label="value"}'
      );
    });
  });

  describe('Metric Names Query', () => {
    it('should call queryLabelValues with correct parameters', async () => {
      const query = new PrometheusMetricFindQuery(datasource, 'metrics(.*metric.*)');
      await query.process(timeRange);

      expect(datasource.languageProvider.queryLabelValues).toHaveBeenCalledWith(
        timeRange,
        '__name__',
        '{__name__=~".*metric.*"}'
      );
    });
  });

  describe('Query Result', () => {
    it('should handle scalar result', async () => {
      datasource.metadataRequest = jest.fn().mockResolvedValue({
        data: {
          data: {
            resultType: 'scalar',
            result: [1234567, '42'],
          },
        },
      });

      const query = new PrometheusMetricFindQuery(datasource, 'query_result(sum(metric))');
      const results = await query.process(timeRange);

      expect(results).toEqual([{ text: '42', expandable: false }]);
    });

    it('should handle vector result', async () => {
      datasource.metadataRequest = jest.fn().mockResolvedValue({
        data: {
          data: {
            resultType: 'vector',
            result: [
              {
                metric: { __name__: 'metric', label: 'value' },
                value: [1234567, '42'],
              },
            ],
          },
        },
      });

      const query = new PrometheusMetricFindQuery(datasource, 'query_result(metric)');
      const results = await query.process(timeRange);

      expect(results).toEqual([
        {
          text: 'metric{label="value"} 42 1234567000',
          expandable: true,
        },
      ]);
    });

    it('should handle scalar result with timestamp', async () => {
      datasource.metadataRequest = jest.fn().mockResolvedValue({
        data: {
          data: {
            resultType: 'scalar',
            result: [1443454528.0, '2'],
          },
        },
      });

      const query = new PrometheusMetricFindQuery(datasource, 'query_result(1+1)');
      const results = await query.process(timeRange);

      expect(results).toEqual([{ text: '2', expandable: false }]);
    });

    it('should handle vector result with metric name and labels', async () => {
      datasource.metadataRequest = jest.fn().mockResolvedValue({
        data: {
          data: {
            resultType: 'vector',
            result: [
              {
                metric: { __name__: 'metric', job: 'testjob' },
                value: [1443454528.0, '3846'],
              },
            ],
          },
        },
      });

      const query = new PrometheusMetricFindQuery(datasource, 'query_result(metric)');
      const results = await query.process(timeRange);

      expect(results).toEqual([{ text: 'metric{job="testjob"} 3846 1443454528000', expandable: true }]);
    });

    it('should throw error for unknown result type', async () => {
      datasource.metadataRequest = jest.fn().mockResolvedValue({
        data: {
          data: {
            resultType: 'unknown',
          },
        },
      });

      const query = new PrometheusMetricFindQuery(datasource, 'query_result(metric)');
      await expect(query.process(timeRange)).rejects.toThrow('Unknown/Unhandled result type: [unknown]');
    });
  });

  describe('Series Query', () => {
    it('should return series', async () => {
      const metric = { __name__: 'metric', label: 'value' };
      datasource.metadataRequest = jest.fn().mockResolvedValue({
        data: {
          data: [metric],
        },
      });

      const query = new PrometheusMetricFindQuery(datasource, 'metric{label="value"}');
      const results = await query.process(timeRange);

      expect(results).toEqual([{ text: 'metric{label="value"}', expandable: true }]);
      expect(datasource.metadataRequest).toHaveBeenCalledWith('/api/v1/series', {
        'match[]': 'metric{label="value"}',
        start: expect.any(String),
        end: expect.any(String),
      });
    });

    it('should return series with metric name and labels', async () => {
      const metric = { __name__: 'up', instance: '127.0.0.1:1234', job: 'job1' };
      datasource.metadataRequest = jest.fn().mockResolvedValue({
        data: {
          data: [metric],
        },
      });

      const query = new PrometheusMetricFindQuery(datasource, 'up{job="job1"}');
      const results = await query.process(timeRange);

      expect(results).toEqual([{ text: 'up{instance="127.0.0.1:1234",job="job1"}', expandable: true }]);
    });
  });

  describe('UTF-8 Support', () => {
    it('should handle UTF-8 label names in label_values query', async () => {
      datasource.languageProvider.queryLabelValues = jest.fn().mockResolvedValue(['value1', 'value2']);

      const query = new PrometheusMetricFindQuery(datasource, 'label_values(metric,instance.test)');
      await query.process(timeRange);

      expect(datasource.languageProvider.queryLabelValues).toHaveBeenCalledWith(timeRange, 'instance.test', 'metric');
    });

    it('should handle UTF-8 metric names in label_values query', async () => {
      datasource.languageProvider.queryLabelValues = jest.fn().mockResolvedValue(['value1', 'value2']);

      const query = new PrometheusMetricFindQuery(datasource, 'label_values(utf8.metric,label)');
      await query.process(timeRange);

      expect(datasource.languageProvider.queryLabelValues).toHaveBeenCalledWith(timeRange, 'label', 'utf8.metric');
    });
  });
});
