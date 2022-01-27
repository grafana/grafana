export class EmptyLanguageProviderMock {
  metrics = [];
  constructor() {}
  start() {
    return new Promise((resolve) => {
      resolve('');
    });
  }
  getLabelKeys() {
    return [];
  }
  getLabelValues() {
    return [];
  }
  fetchSeries() {
    return [];
  }
  fetchSeriesLabels() {
    return [];
  }
}
