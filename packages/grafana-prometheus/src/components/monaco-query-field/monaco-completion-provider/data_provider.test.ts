import type { PrometheusLanguageProvider } from '../../../language_provider';

import { DataProvider, type DataProviderParams } from './data_provider';

const createLanguageProviderMock = (existingMetadata: Record<string, unknown> = {}) => ({
  queryLabelKeys: jest.fn(),
  queryLabelValues: jest.fn(),
  queryMetricsMetadata: jest.fn().mockResolvedValue({}),
  retrieveMetrics: jest.fn().mockReturnValue([]),
  retrieveMetricsMetadata: jest.fn().mockReturnValue(existingMetadata),
});

const createDataProvider = (languageProvider: Partial<PrometheusLanguageProvider>) => {
  return new DataProvider({ languageProvider } as DataProviderParams);
};

describe('DataProvider', () => {
  describe('metadata fetching', () => {
    it('calls queryMetricsMetadata when no metadata is cached', () => {
      const languageProvider = createLanguageProviderMock({});
      createDataProvider(languageProvider);
      expect(languageProvider.queryMetricsMetadata).toHaveBeenCalledTimes(1);
    });

    it('does not call queryMetricsMetadata when metadata is already cached', () => {
      const languageProvider = createLanguageProviderMock({
        http_requests_total: { type: 'counter', help: 'Total HTTP requests' },
      });
      createDataProvider(languageProvider);
      expect(languageProvider.queryMetricsMetadata).not.toHaveBeenCalled();
    });
  });
});
