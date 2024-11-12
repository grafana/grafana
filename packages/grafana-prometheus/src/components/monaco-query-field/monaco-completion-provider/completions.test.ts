import { config } from '@grafana/runtime';

import { SUGGESTIONS_LIMIT } from '../../../language_provider';
import { FUNCTIONS } from '../../../promql';

import { filterMetricNames, getCompletions } from './completions';
import { DataProvider, type DataProviderParams } from './data_provider';
import type { Situation } from './situation';

const history: string[] = ['previous_metric_name_1', 'previous_metric_name_2', 'previous_metric_name_3'];
const dataProviderSettings = {
  languageProvider: {
    datasource: {
      metricNamesAutocompleteSuggestionLimit: SUGGESTIONS_LIMIT,
    },
    getLabelKeys: jest.fn(),
    getLabelValues: jest.fn(),
    getSeriesLabels: jest.fn(),
    getSeriesValues: jest.fn(),
    metrics: [],
    metricsMetadata: {},
  },
  historyProvider: history.map((expr, idx) => ({ query: { expr, refId: 'some-ref' }, ts: idx })),
} as unknown as DataProviderParams;
let dataProvider = new DataProvider(dataProviderSettings);
const metrics = {
  beyondLimit: Array.from(Array(SUGGESTIONS_LIMIT + 1), (_, i) => `metric_name_${i}`),
  get atLimit() {
    return this.beyondLimit.slice(0, SUGGESTIONS_LIMIT - 1);
  },
};

beforeEach(() => {
  dataProvider = new DataProvider(dataProviderSettings);
  jest.replaceProperty(config, 'featureToggles', {
    prometheusCodeModeMetricNamesSearch: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('filterMetricNames', () => {
  const sampleMetrics = [
    'http_requests_total',
    'http_requests_failed',
    'node_cpu_seconds_total',
    'node_memory_usage_bytes',
    'very_long_metric_name_with_many_underscores_and_detailed_description',
    'complex_metric_with_extra_terms_for_testing_complexity_included',
  ];

  describe('simple queries (intraMode: 1)', () => {
    it('should return all metrics when input is empty', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: '',
        limit: 10,
      });
      expect(result).toEqual(sampleMetrics.slice(0, 10));
    });

    it('should match exact substrings', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'requests',
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');
      expect(result).toContainEqual('http_requests_failed');
    });

    it('should match with single character errors', () => {
      // Test single substitution
      let result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'raquests', // 'e' replaced with 'a'
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');

      // Test single transposition
      result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'reqeusts', // 'u' and 'e' swapped
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');

      // Test single deletion
      result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'rquests', // 'e' deleted
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');

      // Test single insertion
      result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'reqquests', // extra 'q' inserted
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');
    });

    it('should not match with multiple errors', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'raqests', // Two errors: 'e' replaced with 'a' and 'u' deleted
        limit: 10,
      });
      expect(result).not.toContainEqual('http_requests_total');
    });
  });

  describe('complex queries (intraMode: 0)', () => {
    it('should use substring matching for queries with many terms', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'metric with extra terms for complexity',
        limit: 10,
      });
      expect(result).toContainEqual('complex_metric_with_extra_terms_for_testing_complexity_included');
      expect(result).not.toContainEqual('http_requests_total'); // Shouldn't match partial terms
    });

    it('should use substring matching for long copy-pasted queries', () => {
      const longQuery = 'very_long_metric_name_with_many_underscores_and_detailed_description';
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: longQuery,
        limit: 10,
      });
      expect(result).toContainEqual(longQuery);
    });

    it('should match characters in sequence for long queries', () => {
      // This tests intraMode: 0 behavior where characters must appear in sequence
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'h r t', // Should match because these letters appear in sequence in http_requests_total
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');
    });

    it('should use substring matching for long copy-pasted queries', () => {
      const longQuery = 'very_long_metric_name_with_many_underscores_and_detailed_description';
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: longQuery,
        limit: 10,
      });
      expect(result).toContainEqual(longQuery);
    });

    it('should handle no matches gracefully', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'nonexistentmetricname',
        limit: 10,
      });
      expect(result).toHaveLength(0);
    });
  });

  it('should respect the limit parameter', () => {
    // Create array with many matching items
    const manyMetrics = Array.from({ length: 100 }, (_, i) => `http_requests_total_${i}`);

    const result = filterMetricNames({
      metricNames: manyMetrics,
      inputText: 'requests',
      limit: 5,
    });
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

type MetricNameSituation = Extract<Situation['type'], 'AT_ROOT' | 'EMPTY' | 'IN_FUNCTION'>;
const metricNameCompletionSituations = ['AT_ROOT', 'IN_FUNCTION', 'EMPTY'] as MetricNameSituation[];

function getSuggestionCountForSituation(situationType: MetricNameSituation, metricsCount: number): number {
  const limitedMetricNamesCount = metricsCount < SUGGESTIONS_LIMIT ? metricsCount : SUGGESTIONS_LIMIT;
  let suggestionsCount = limitedMetricNamesCount + FUNCTIONS.length;

  if (situationType === 'EMPTY') {
    suggestionsCount += history.length;
  }

  return suggestionsCount;
}

describe.each(metricNameCompletionSituations)('metric name completions in situation %s', (situationType) => {
  it('should return completions for all metric names when the number of metric names is at or below the limit', async () => {
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValue(metrics.atLimit);
    const expectedCompletionsCount = getSuggestionCountForSituation(situationType, metrics.atLimit.length);
    const situation: Situation = {
      type: situationType,
    };

    // No text input
    dataProvider.monacoSettings.setInputInRange('');
    let completions = await getCompletions(situation, dataProvider);
    expect(completions).toHaveLength(expectedCompletionsCount);

    // With text input (use fuzzy search)
    dataProvider.monacoSettings.setInputInRange('name_1');
    completions = await getCompletions(situation, dataProvider);
    expect(completions?.length).toBeLessThanOrEqual(expectedCompletionsCount);
  });

  it('should limit completions for metric names when the number of metric names is greater than the limit', async () => {
    const situation: Situation = {
      type: situationType,
    };
    const expectedCompletionsCount = getSuggestionCountForSituation(situationType, metrics.beyondLimit.length);
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValue(metrics.beyondLimit);

    // No text input
    dataProvider.monacoSettings.setInputInRange('');
    let completions = await getCompletions(situation, dataProvider);
    expect(completions).toHaveLength(expectedCompletionsCount);

    // With text input (use fuzzy search)
    dataProvider.monacoSettings.setInputInRange('name_1');
    completions = await getCompletions(situation, dataProvider);
    expect(completions?.length).toBeLessThanOrEqual(expectedCompletionsCount);
  });

  it('should enable autocomplete suggestions update when the number of metric names is greater than the limit', async () => {
    const situation: Situation = {
      type: situationType,
    };

    // Do not cross the metrics names threshold
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValueOnce(metrics.atLimit);
    dataProvider.monacoSettings.setInputInRange('name_1');
    await getCompletions(situation, dataProvider);
    expect(dataProvider.monacoSettings.suggestionsIncomplete).toBe(false);

    // Cross the metric names threshold, without text input
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValueOnce(metrics.beyondLimit);
    dataProvider.monacoSettings.setInputInRange('');
    await getCompletions(situation, dataProvider);
    expect(dataProvider.monacoSettings.suggestionsIncomplete).toBe(true);

    // Cross the metric names threshold, with text input
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValueOnce(metrics.beyondLimit);
    dataProvider.monacoSettings.setInputInRange('name_1');
    await getCompletions(situation, dataProvider);
    expect(dataProvider.monacoSettings.suggestionsIncomplete).toBe(true);
  });

  it('should handle complex queries efficiently', async () => {
    const situation: Situation = {
      type: situationType,
    };

    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValue(metrics.beyondLimit);

    // Test with a complex (long) query
    dataProvider.monacoSettings.setInputInRange('metric_name_1_with_many_extra_terms_to_trigger_complex_handling');
    const completions = await getCompletions(situation, dataProvider);

    // Should still respect the suggestions limit
    const expectedCompletionsCount = getSuggestionCountForSituation(situationType, metrics.beyondLimit.length);
    expect(completions.length).toBeLessThanOrEqual(expectedCompletionsCount);

    // Results should contain relevant matches
    const metricCompletions = completions.filter((c) => c.type === 'METRIC_NAME');
    expect(metricCompletions.some((c) => c.label.includes('metric_name_1'))).toBe(true);
  });

  it('should handle multiple term queries efficiently', async () => {
    const situation: Situation = {
      type: situationType,
    };

    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValue(metrics.beyondLimit);

    // Test with multiple terms
    dataProvider.monacoSettings.setInputInRange('metric name 1 2 3 4 5');
    const completions = await getCompletions(situation, dataProvider);

    const expectedCompletionsCount = getSuggestionCountForSituation(situationType, metrics.beyondLimit.length);
    expect(completions.length).toBeLessThanOrEqual(expectedCompletionsCount);
  });
});
