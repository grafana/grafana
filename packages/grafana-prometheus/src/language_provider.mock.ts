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
  fetchSeries = jest.fn().mockReturnValue([]);
  fetchSeriesLabels = jest.fn().mockReturnValue([]);
  fetchSeriesLabelsMatch = jest.fn().mockReturnValue([]);
  fetchLabelsWithMatch = jest.fn().mockReturnValue([]);
  fetchLabels = jest.fn();
  loadMetricsMetadata = jest.fn();
}
