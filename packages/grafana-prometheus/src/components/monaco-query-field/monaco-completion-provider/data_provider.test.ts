import { HistoryItem } from '@grafana/data';

import { DEFAULT_SUGGESTIONS_LIMIT, METRIC_LABEL } from '../../../constants';
import { PrometheusLanguageProviderInterface } from '../../../language_provider';
import { getMockTimeRange } from '../../../test/mocks/datasource';
import { PromQuery } from '../../../types';

import {
  DataProvider,
  DataProviderParams,
  CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT,
  isSuggestionsIncompleteEvent,
} from './data_provider';

// Mock the utf8 support module
jest.mock('../../../utf8_support', () => ({
  isValidLegacyName: jest.fn((name: string) => {
    // Mock implementation for testing
    return /^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name);
  }),
  escapeForUtf8Support: jest.fn((value: string) => {
    // Mock implementation - just return the input for testing
    return value;
  }),
}));

// Mock the language provider functions
jest.mock('../../../language_provider', () => ({
  ...jest.requireActual('../../../language_provider'),
  removeQuotesIfExist: jest.fn((value: string) => {
    // Mock implementation - remove quotes if they exist
    return value.replace(/^"(.*)"$/, '$1');
  }),
}));

describe('DataProvider', () => {
  let mockLanguageProvider: jest.Mocked<PrometheusLanguageProviderInterface>;
  let mockHistoryProvider: Array<HistoryItem<PromQuery>>;
  let dataProviderParams: DataProviderParams;
  let dataProvider: DataProvider;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Create mock language provider
    mockLanguageProvider = {
      queryLabelValues: jest.fn(),
      queryLabelKeys: jest.fn(),
      retrieveMetricsMetadata: jest.fn(),
      datasource: {
        uid: 'test-datasource-uid',
      },
    } as unknown as jest.Mocked<PrometheusLanguageProviderInterface>;

    // Create mock history provider
    mockHistoryProvider = [
      { query: { expr: 'rate(http_requests_total[5m])', refId: 'A' }, ts: 1000 },
      { query: { expr: 'up', refId: 'B' }, ts: 2000 },
      { query: { expr: '', refId: 'C' }, ts: 3000 }, // Empty expression
      { query: { expr: 'node_cpu_seconds_total', refId: 'D' }, ts: 4000 },
    ];

    dataProviderParams = {
      languageProvider: mockLanguageProvider,
      historyProvider: mockHistoryProvider,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid parameters', () => {
      dataProvider = new DataProvider(dataProviderParams);

      expect(dataProvider.languageProvider).toBe(mockLanguageProvider);
      expect(dataProvider.historyProvider).toBe(mockHistoryProvider);
      expect(dataProvider.metricNamesSuggestionLimit).toBe(DEFAULT_SUGGESTIONS_LIMIT);
      expect(dataProvider.monacoSettings.inputInRange).toBe('');
      expect(dataProvider.monacoSettings.suggestionsIncomplete).toBe(false);
    });

    it('should bind methods correctly', () => {
      dataProvider = new DataProvider(dataProviderParams);

      expect(dataProvider.queryLabelKeys).toBeDefined();
      expect(dataProvider.queryLabelValues).toBeDefined();
      expect(typeof dataProvider.queryLabelKeys).toBe('function');
      expect(typeof dataProvider.queryLabelValues).toBe('function');
    });

    it('should initialize with empty inputInRange and suggestionsIncomplete false', () => {
      dataProvider = new DataProvider(dataProviderParams);

      expect(dataProvider.monacoSettings.inputInRange).toBe('');
      expect(dataProvider.monacoSettings.suggestionsIncomplete).toBe(false);
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      dataProvider = new DataProvider(dataProviderParams);
    });

    it('should return filtered history expressions', () => {
      const history = dataProvider.getHistory();

      expect(history).toEqual(['rate(http_requests_total[5m])', 'up', 'node_cpu_seconds_total']);
    });

    it('should filter out empty expressions', () => {
      const historyWithEmpty = [
        { query: { expr: 'valid_expression', refId: 'A' }, ts: 1000 },
        { query: { expr: '', refId: 'B' }, ts: 2000 },
        { query: { expr: null, refId: 'C' }, ts: 3000 },
        { query: { expr: undefined, refId: 'D' }, ts: 4000 },
      ] as any;

      const providerWithEmpty = new DataProvider({
        languageProvider: mockLanguageProvider,
        historyProvider: historyWithEmpty,
      });

      const history = providerWithEmpty.getHistory();
      expect(history).toEqual(['valid_expression']);
    });

    it('should return empty array when history provider is empty', () => {
      const providerWithEmptyHistory = new DataProvider({
        languageProvider: mockLanguageProvider,
        historyProvider: [],
      });

      const history = providerWithEmptyHistory.getHistory();
      expect(history).toEqual([]);
    });
  });

  describe('queryMetricNames', () => {
    const mockTimeRange = getMockTimeRange();

    beforeEach(() => {
      dataProvider = new DataProvider(dataProviderParams);
    });

    it('should query metric names without word filter', async () => {
      const mockMetrics = ['metric1', 'metric2', 'metric3'];
      mockLanguageProvider.queryLabelValues.mockResolvedValue(mockMetrics);

      const result = await dataProvider.queryMetricNames(mockTimeRange, undefined);

      expect(mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        mockTimeRange,
        METRIC_LABEL,
        undefined,
        DEFAULT_SUGGESTIONS_LIMIT
      );
      expect(result).toEqual(mockMetrics);
    });

    it('should query metric names with word filter', async () => {
      const mockMetrics = ['http_requests_total', 'http_requests_failed'];
      mockLanguageProvider.queryLabelValues.mockResolvedValue(mockMetrics);

      const result = await dataProvider.queryMetricNames(mockTimeRange, 'http');

      expect(mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        mockTimeRange,
        METRIC_LABEL,
        '{__name__=~".*http.*"}',
        DEFAULT_SUGGESTIONS_LIMIT
      );
      expect(result).toEqual(mockMetrics);
    });

    it('should handle quoted word filter using removeQuotesIfExist', async () => {
      const mockMetrics = ['metric_with_quotes'];
      mockLanguageProvider.queryLabelValues.mockResolvedValue(mockMetrics);

      const result = await dataProvider.queryMetricNames(mockTimeRange, '"quoted_metric"');

      expect(mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        mockTimeRange,
        METRIC_LABEL,
        '{__name__=~".*quoted_metric.*"}',
        DEFAULT_SUGGESTIONS_LIMIT
      );
      expect(result).toEqual(mockMetrics);
    });

    it('should use escapeForUtf8Support on the word filter', async () => {
      const { escapeForUtf8Support } = require('../../../utf8_support');
      const { removeQuotesIfExist } = require('../../../language_provider');

      const mockMetrics = ['utf8_metric'];
      mockLanguageProvider.queryLabelValues.mockResolvedValue(mockMetrics);

      await dataProvider.queryMetricNames(mockTimeRange, 'test_word');

      expect(removeQuotesIfExist).toHaveBeenCalledWith('test_word');
      expect(escapeForUtf8Support).toHaveBeenCalledWith('test_word');
    });

    it('should handle empty string word filter', async () => {
      const mockMetrics = ['metric1', 'metric2'];
      mockLanguageProvider.queryLabelValues.mockResolvedValue(mockMetrics);

      const result = await dataProvider.queryMetricNames(mockTimeRange, '');

      expect(mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        mockTimeRange,
        METRIC_LABEL,
        undefined,
        DEFAULT_SUGGESTIONS_LIMIT
      );
      expect(result).toEqual(mockMetrics);
    });

    it('should handle API errors gracefully', async () => {
      mockLanguageProvider.queryLabelValues.mockRejectedValue(new Error('API Error'));

      const result = await dataProvider.queryMetricNames(mockTimeRange, 'test');

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('Failed to query metric names:', expect.any(Error));
    });

    it('should handle non-array API responses', async () => {
      mockLanguageProvider.queryLabelValues.mockResolvedValue('not an array' as any);

      const result = await dataProvider.queryMetricNames(mockTimeRange, 'test');

      expect(result).toEqual([]);
    });
  });

  describe('metricNamesToMetrics', () => {
    beforeEach(() => {
      dataProvider = new DataProvider(dataProviderParams);
    });

    it('should convert metric names to metrics with metadata', () => {
      const mockMetadata = {
        metric1: { help: 'Help for metric1', type: 'counter' },
        metric2: { help: 'Help for metric2', type: 'gauge' },
        metric3: { help: 'Help for metric3', type: 'histogram' },
      };
      mockLanguageProvider.retrieveMetricsMetadata.mockReturnValue(mockMetadata);

      const metricNames = ['metric1', 'metric2', 'metric3'];
      const result = dataProvider.metricNamesToMetrics(metricNames);

      expect(result).toEqual([
        { name: 'metric1', help: 'Help for metric1', type: 'counter', isUtf8: false },
        { name: 'metric2', help: 'Help for metric2', type: 'gauge', isUtf8: false },
        { name: 'metric3', help: 'Help for metric3', type: 'histogram', isUtf8: false },
      ]);
    });

    it('should handle metrics without metadata', () => {
      mockLanguageProvider.retrieveMetricsMetadata.mockReturnValue({});

      const metricNames = ['unknown_metric'];
      const result = dataProvider.metricNamesToMetrics(metricNames);

      expect(result).toEqual([{ name: 'unknown_metric', help: '', type: '', isUtf8: false }]);
    });

    it('should handle UTF-8 metric names', () => {
      const { isValidLegacyName } = require('../../../utf8_support');
      isValidLegacyName.mockReturnValue(false);

      mockLanguageProvider.retrieveMetricsMetadata.mockReturnValue({});

      const metricNames = ['metric-with-unicode-🚀'];
      const result = dataProvider.metricNamesToMetrics(metricNames);

      expect(result).toEqual([{ name: 'metric-with-unicode-🚀', help: '', type: '', isUtf8: true }]);
    });

    it('should handle empty array input', () => {
      const result = dataProvider.metricNamesToMetrics([]);

      expect(result).toEqual([]);
    });

    it('should handle null metadata', () => {
      mockLanguageProvider.retrieveMetricsMetadata.mockReturnValue(null as any);

      const metricNames = ['metric1'];
      const result = dataProvider.metricNamesToMetrics(metricNames);

      expect(result).toEqual([{ name: 'metric1', help: '', type: '', isUtf8: true }]);
    });
  });

  describe('enableAutocompleteSuggestionsUpdate', () => {
    beforeEach(() => {
      dataProvider = new DataProvider(dataProviderParams);
      // Mock dispatchEvent globally
      jest.spyOn(global, 'dispatchEvent').mockImplementation(() => true);
    });

    it('should enable suggestions update and dispatch event', () => {
      const settings = dataProvider.monacoSettings;

      expect(settings.suggestionsIncomplete).toBe(false);

      settings.enableAutocompleteSuggestionsUpdate();

      expect(dataProvider.monacoSettings.suggestionsIncomplete).toBe(true);
      expect(global.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT,
          detail: {
            limit: DEFAULT_SUGGESTIONS_LIMIT,
            datasourceUid: 'test-datasource-uid',
          },
        })
      );
    });

    it('should create proper CustomEvent with correct detail', () => {
      const settings = dataProvider.monacoSettings;

      settings.enableAutocompleteSuggestionsUpdate();

      const dispatchedEvent = (global.dispatchEvent as jest.Mock).mock.calls[0][0];
      expect(dispatchedEvent).toBeInstanceOf(CustomEvent);
      expect(dispatchedEvent.type).toBe(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT);
      expect(dispatchedEvent.detail).toEqual({
        limit: DEFAULT_SUGGESTIONS_LIMIT,
        datasourceUid: 'test-datasource-uid',
      });
    });
  });

  describe('setInputInRange', () => {
    beforeEach(() => {
      dataProvider = new DataProvider(dataProviderParams);
    });

    it('should set input in range', () => {
      const settings = dataProvider.monacoSettings;

      expect(settings.inputInRange).toBe('');

      settings.setInputInRange('test input');

      expect(dataProvider.monacoSettings.inputInRange).toBe('test input');
    });

    it('should handle empty string', () => {
      const settings = dataProvider.monacoSettings;

      settings.setInputInRange('');

      expect(dataProvider.monacoSettings.inputInRange).toBe('');
    });

    it('should handle multiple calls', () => {
      const settings = dataProvider.monacoSettings;

      settings.setInputInRange('first');
      expect(dataProvider.monacoSettings.inputInRange).toBe('first');

      settings.setInputInRange('second');
      expect(dataProvider.monacoSettings.inputInRange).toBe('second');
    });
  });

  describe('monacoSettings', () => {
    beforeEach(() => {
      dataProvider = new DataProvider(dataProviderParams);
    });

    it('should return correct monaco settings', () => {
      const settings = dataProvider.monacoSettings;

      expect(settings).toHaveProperty('enableAutocompleteSuggestionsUpdate');
      expect(settings).toHaveProperty('inputInRange');
      expect(settings).toHaveProperty('setInputInRange');
      expect(settings).toHaveProperty('suggestionsIncomplete');
      expect(typeof settings.enableAutocompleteSuggestionsUpdate).toBe('function');
      expect(typeof settings.setInputInRange).toBe('function');
      expect(settings.inputInRange).toBe('');
      expect(settings.suggestionsIncomplete).toBe(false);
    });

    it('should maintain consistent state across multiple calls', () => {
      const settings1 = dataProvider.monacoSettings;
      const settings2 = dataProvider.monacoSettings;

      expect(settings1.inputInRange).toBe(settings2.inputInRange);
      expect(settings1.suggestionsIncomplete).toBe(settings2.suggestionsIncomplete);
    });

    it('should reflect changes in input range', () => {
      const settings = dataProvider.monacoSettings;

      settings.setInputInRange('test');

      const updatedSettings = dataProvider.monacoSettings;
      expect(updatedSettings.inputInRange).toBe('test');
    });

    it('should reflect changes in suggestions incomplete state', () => {
      jest.spyOn(global, 'dispatchEvent').mockImplementation(() => true);

      const settings = dataProvider.monacoSettings;

      settings.enableAutocompleteSuggestionsUpdate();

      const updatedSettings = dataProvider.monacoSettings;
      expect(updatedSettings.suggestionsIncomplete).toBe(true);
    });
  });
});

describe('isSuggestionsIncompleteEvent', () => {
  it('should return true for valid SuggestionsIncompleteEvent', () => {
    const event = new CustomEvent(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, {
      detail: { limit: 1000, datasourceUid: 'test-uid' },
    });

    expect(isSuggestionsIncompleteEvent(event)).toBe(true);
  });

  it('should return false for invalid event type', () => {
    const event = new CustomEvent('other-event', {
      detail: { limit: 1000, datasourceUid: 'test-uid' },
    });

    expect(isSuggestionsIncompleteEvent(event)).toBe(false);
  });

  it('should return false for event without detail', () => {
    const event = new CustomEvent(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT);

    expect(isSuggestionsIncompleteEvent(event)).toBe(false);
  });

  it('should return false for event with invalid detail structure', () => {
    const event = new CustomEvent(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, {
      detail: { limit: 1000 }, // missing datasourceUid
    });

    expect(isSuggestionsIncompleteEvent(event)).toBe(false);
  });

  it('should return false for event with null detail', () => {
    const event = new CustomEvent(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, {
      detail: null,
    });

    expect(isSuggestionsIncompleteEvent(event)).toBe(false);
  });

  it('should return false for regular Event objects', () => {
    const event = new Event(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT);

    expect(isSuggestionsIncompleteEvent(event)).toBe(false);
  });

  it('should return false for event with non-object detail', () => {
    const event = new CustomEvent(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, {
      detail: 'not an object',
    });

    expect(isSuggestionsIncompleteEvent(event)).toBe(false);
  });

  it('should return false for event with missing limit in detail', () => {
    const event = new CustomEvent(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, {
      detail: { datasourceUid: 'test-uid' }, // missing limit
    });

    expect(isSuggestionsIncompleteEvent(event)).toBe(false);
  });
});
