// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_provider.mock.ts
import { TimeRange } from '@grafana/data';

export class EmptyLanguageProviderMock {
  metrics = [];

  constructor() {}

  start = (timeRange?: TimeRange): Promise<any[]> => Promise.resolve([]);

  getLabelKeys = jest.fn().mockReturnValue([]);
  getLabelValues = jest.fn().mockReturnValue([]);
  getSeries = jest.fn().mockReturnValue({ __name__: [] });
  getSeriesValues = jest.fn().mockReturnValue([]);
  fetchSeries = jest.fn().mockReturnValue([]);
  fetchSeriesLabels = jest.fn().mockReturnValue([]);
  fetchSeriesLabelsMatch = jest.fn().mockReturnValue([]);
  fetchLabelsWithMatch = jest.fn().mockReturnValue([]);
  fetchLabels = jest.fn();
  loadMetricsMetadata = jest.fn();
  retrieveMetrics = jest.fn().mockReturnValue(['metric']);
  queryLabelKeys = jest.fn().mockResolvedValue([]);
  queryLabelValues = jest.fn().mockResolvedValue([]);
  retrieveLabelKeys = jest.fn().mockReturnValue([]);
  retrieveMetricsMetadata = jest.fn().mockReturnValue({});
  queryMetricsMetadata = jest.fn().mockResolvedValue({});
}
