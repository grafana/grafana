// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_provider.mock.ts
export class EmptyLanguageProviderMock {
  metrics = [];

  constructor() {}

  start() {
    return new Promise((resolve) => {
      resolve('');
    });
  }

  retrieveMetrics = jest.fn().mockReturnValue(['metric']);
  queryLabelKeys = jest.fn().mockResolvedValue([]);
  queryLabelValues = jest.fn().mockResolvedValue([]);
  retrieveLabelKeys = jest.fn().mockReturnValue([]);
  retrieveMetricsMetadata = jest
    .fn()
    .mockReturnValue({ histogram_metric_sum: { type: 'counter', help: '', unit: 'sum' } });
  queryMetricsMetadata = jest.fn().mockResolvedValue({});
}
