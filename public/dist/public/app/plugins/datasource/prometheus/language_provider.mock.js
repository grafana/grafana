export class EmptyLanguageProviderMock {
    constructor() {
        this.metrics = [];
        this.getLabelKeys = jest.fn().mockReturnValue([]);
        this.getLabelValues = jest.fn().mockReturnValue([]);
        this.getSeries = jest.fn().mockReturnValue({ __name__: [] });
        this.fetchSeries = jest.fn().mockReturnValue([]);
        this.fetchSeriesLabels = jest.fn().mockReturnValue([]);
        this.fetchSeriesLabelsMatch = jest.fn().mockReturnValue([]);
        this.fetchLabels = jest.fn();
        this.loadMetricsMetadata = jest.fn();
    }
    start() {
        return new Promise((resolve) => {
            resolve('');
        });
    }
}
//# sourceMappingURL=language_provider.mock.js.map