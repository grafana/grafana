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
    'metric_name_1_with_extra_terms_included',
  ];

  describe('empty input', () => {
    it('should return all metrics up to limit when input is empty', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: '',
        limit: 3,
      });
      expect(result).toEqual(sampleMetrics.slice(0, 3));
    });

    it('should return all metrics when input is whitespace', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: '   ',
        limit: 3,
      });
      expect(result).toEqual(sampleMetrics.slice(0, 3));
    });
  });

  describe('simple searches (≤ 4 terms)', () => {
    it('should match exact strings', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'http_requests_total',
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');
    });

    it('should match with single character errors', () => {
      // substitution
      let result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'http_requezts_total', // 's' replaced with 'z'
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');

      // ransposition
      result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'http_reqeust_total', // 'ue' swapped
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');

      // deletion
      result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'http_reqests_total', // missing 'u'
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');

      // insertion
      result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'http_reqquests_total', // extra 'q'
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');
    });

    it('should match partial strings', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'requests', // partial match
        limit: 10,
      });
      expect(result).toContainEqual('http_requests_total');
      expect(result).toContainEqual('http_requests_failed');
    });

    it('should not match with multiple errors', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'htp_reqests_total', // two errors: missing 't' and missing 'u'
        limit: 10,
      });
      expect(result).not.toContainEqual('http_requests_total');
    });
  });

  describe('complex searches (> 4 terms)', () => {
    it('should use substring matching for each term', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'metric name 1 with extra terms',
        limit: 10,
      });
      expect(result).toContainEqual('metric_name_1_with_extra_terms_included');
    });

    it('should return empty array when no metrics match all terms', () => {
      const result = filterMetricNames({
        metricNames: sampleMetrics,
        inputText: 'metric name 1 with nonexistent terms',
        limit: 10,
      });
      expect(result).toHaveLength(0);
    });

    it('should stop searching after limit is reached', () => {
      const manyMetrics = Array.from({ length: 10 }, (_, i) => `metric_name_${i}_with_terms`);

      const result = filterMetricNames({
        metricNames: manyMetrics,
        inputText: 'metric name with terms other words', // > 4 terms
        limit: 3,
      });

      expect(result.length).toBeLessThanOrEqual(3);
    });
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

  it('should limit completions for metric names when the number exceeds the limit', async () => {
    const situation: Situation = {
      type: situationType,
    };
    const expectedCompletionsCount = getSuggestionCountForSituation(situationType, metrics.beyondLimit.length);
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValue(metrics.beyondLimit);

    // Complex query
    dataProvider.monacoSettings.setInputInRange('metric name one two three four five');
    let completions = await getCompletions(situation, dataProvider);
    expect(completions.length).toBeLessThanOrEqual(expectedCompletionsCount);

    // Simple query with fuzzy match
    dataProvider.monacoSettings.setInputInRange('metric_name_');
    completions = await getCompletions(situation, dataProvider);
    expect(completions.length).toBeLessThanOrEqual(expectedCompletionsCount);
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

    const testMetrics = ['metric_name_1', 'metric_name_2', 'metric_name_1_with_extra_terms', 'unrelated_metric'];
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValue(testMetrics);

    // Test with a complex query (> 4 terms)
    dataProvider.monacoSettings.setInputInRange('metric name 1 with extra terms more');
    const completions = await getCompletions(situation, dataProvider);

    const metricCompletions = completions.filter((c) => c.type === 'METRIC_NAME');
    expect(metricCompletions.some((c) => c.label === 'metric_name_1_with_extra_terms')).toBe(true);
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
