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
  fetchLabels = jest.fn();
  loadMetricsMetadata = jest.fn();
}
