// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_provider.mock.ts
export class EmptyLanguageProviderMock {
  metrics = [];

  constructor() {}

  start() {
    return new Promise((resolve) => {
      resolve('');
    });
  }

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
  retrieveMetricsMetadata = jest
    .fn()
    .mockReturnValue({ histogram_metric_sum: { type: 'counter', help: '', unit: 'sum' } });
  queryMetricsMetadata = jest.fn().mockResolvedValue({});
}
