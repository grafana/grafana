import { config } from '@grafana/runtime';

import { SUGGESTIONS_LIMIT } from '../../../constants';
import { FUNCTIONS } from '../../../promql';
import { getMockTimeRange } from '../../../test/mocks/datasource';

import { getCompletions } from './completions';
import { DataProvider, type DataProviderParams } from './data_provider';
import type { Situation } from './situation';

const history: string[] = ['previous_metric_name_1', 'previous_metric_name_2', 'previous_metric_name_3'];
const dataProviderSettings = {
  languageProvider: {
    queryLabelKeys: jest.fn(),
    queryLabelValues: jest.fn(),
    retrieveLabelKeys: jest.fn(),
    retrieveMetricsMetadata: jest.fn(),
  },
  historyProvider: history.map((expr, idx) => ({ query: { expr, refId: 'some-ref' }, ts: idx })),
} as unknown as DataProviderParams;
let dataProvider = new DataProvider(dataProviderSettings);
const metrics = {
  get atLimit() {
    return Array.from(Array(SUGGESTIONS_LIMIT - 1), (_, i) => `metric_name_${i}`);
  },
};

beforeEach(() => {
  dataProvider = new DataProvider(dataProviderSettings);
});

afterEach(() => {
  jest.restoreAllMocks();
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
  const timeRange = getMockTimeRange();

  it('should return completions for all metric names when the number of metric names is at or below the limit', async () => {
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValue(metrics.atLimit);
    const expectedCompletionsCount = getSuggestionCountForSituation(situationType, metrics.atLimit.length);
    const situation: Situation = {
      type: situationType,
    };

    // No text input
    dataProvider.monacoSettings.setInputInRange('');
    let completions = await getCompletions(situation, dataProvider, timeRange);
    expect(completions).toHaveLength(expectedCompletionsCount);

    // With text input (use fuzzy search)
    dataProvider.monacoSettings.setInputInRange('name_1');
    completions = await getCompletions(situation, dataProvider, timeRange);
    expect(completions?.length).toBeLessThanOrEqual(expectedCompletionsCount);
  });

  it('should handle complex queries efficiently', async () => {
    const situation: Situation = {
      type: situationType,
    };

    const testMetrics = ['metric_name_1', 'metric_name_2', 'metric_name_1_with_extra_terms', 'unrelated_metric'];
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValue(testMetrics);

    // Test with a complex query (> 4 terms)
    dataProvider.monacoSettings.setInputInRange('metric name 1 with extra terms more');
    const completions = await getCompletions(situation, dataProvider, timeRange);

    const metricCompletions = completions.filter((c) => c.type === 'METRIC_NAME');
    expect(metricCompletions.some((c) => c.label === 'metric_name_1_with_extra_terms')).toBe(true);
  });

  it('should handle multiple term queries efficiently', async () => {
    const situation: Situation = {
      type: situationType,
    };

    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValue(metrics.atLimit);

    // Test with multiple terms
    dataProvider.monacoSettings.setInputInRange('metric name 1 2 3 4 5');
    const completions = await getCompletions(situation, dataProvider, timeRange);

    const expectedCompletionsCount = getSuggestionCountForSituation(situationType, metrics.atLimit.length);
    expect(completions.length).toBeLessThanOrEqual(expectedCompletionsCount);
  });
});

describe('Label value completions', () => {
  let dataProvider: DataProvider;

  beforeEach(() => {
    dataProvider = {
      getAllMetricNames: jest.fn(),
      metricNamesToMetrics: jest.fn(),
      getHistory: jest.fn(),
      getLabelValues: jest.fn().mockResolvedValue(['value1', 'value"2', 'value\\3', "value'4"]),
      monacoSettings: {
        setInputInRange: jest.fn(),
        inputInRange: '',
      },
      metricNamesSuggestionLimit: 100,
    } as unknown as DataProvider;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with prometheusSpecialCharsInLabelValues disabled', () => {
    beforeEach(() => {
      jest.replaceProperty(config, 'featureToggles', {
        prometheusSpecialCharsInLabelValues: false,
      });
    });

    const timeRange = getMockTimeRange();

    it('should not escape special characters when between quotes', async () => {
      const situation: Situation = {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        labelName: 'testLabel',
        betweenQuotes: true,
        otherLabels: [],
      };

      const completions = await getCompletions(situation, dataProvider, timeRange);

      expect(completions).toHaveLength(4);
      expect(completions[0].insertText).toBe('value1');
      expect(completions[1].insertText).toBe('value"2');
      expect(completions[2].insertText).toBe('value\\3');
      expect(completions[3].insertText).toBe("value'4");
    });

    it('should wrap in quotes but not escape special characters when not between quotes', async () => {
      const situation: Situation = {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        labelName: 'testLabel',
        betweenQuotes: false,
        otherLabels: [],
      };

      const completions = await getCompletions(situation, dataProvider, timeRange);

      expect(completions).toHaveLength(4);
      expect(completions[0].insertText).toBe('"value1"');
      expect(completions[1].insertText).toBe('"value"2"');
      expect(completions[2].insertText).toBe('"value\\3"');
      expect(completions[3].insertText).toBe('"value\'4"');
    });
  });

  describe('with prometheusSpecialCharsInLabelValues enabled', () => {
    beforeEach(() => {
      jest.replaceProperty(config, 'featureToggles', {
        prometheusSpecialCharsInLabelValues: true,
      });
    });

    const timeRange = getMockTimeRange();

    it('should escape special characters when between quotes', async () => {
      const situation: Situation = {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        labelName: 'testLabel',
        betweenQuotes: true,
        otherLabels: [],
      };

      const completions = await getCompletions(situation, dataProvider, timeRange);

      expect(completions).toHaveLength(4);
      expect(completions[0].insertText).toBe('value1');
      expect(completions[1].insertText).toBe('value\\"2');
      expect(completions[2].insertText).toBe('value\\\\3');
      expect(completions[3].insertText).toBe("value'4");
    });

    it('should wrap in quotes and escape special characters when not between quotes', async () => {
      const situation: Situation = {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        labelName: 'testLabel',
        betweenQuotes: false,
        otherLabels: [],
      };

      const completions = await getCompletions(situation, dataProvider, timeRange);

      expect(completions).toHaveLength(4);
      expect(completions[0].insertText).toBe('"value1"');
      expect(completions[1].insertText).toBe('"value\\"2"');
      expect(completions[2].insertText).toBe('"value\\\\3"');
      expect(completions[3].insertText).toBe('"value\'4"');
    });
  });

  describe('label value escaping edge cases', () => {
    beforeEach(() => {
      jest.replaceProperty(config, 'featureToggles', {
        prometheusSpecialCharsInLabelValues: true,
      });
    });

    const timeRange = getMockTimeRange();

    it('should handle empty values', async () => {
      jest.spyOn(dataProvider, 'getLabelValues').mockResolvedValue(['']);

      const situation: Situation = {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        labelName: 'testLabel',
        betweenQuotes: false,
        otherLabels: [],
      };

      const completions = await getCompletions(situation, dataProvider, timeRange);
      expect(completions).toHaveLength(1);
      expect(completions[0].insertText).toBe('""');
    });

    it('should handle values with multiple special characters', async () => {
      jest.spyOn(dataProvider, 'getLabelValues').mockResolvedValue(['test"\\value']);

      const situation: Situation = {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        labelName: 'testLabel',
        betweenQuotes: true,
        otherLabels: [],
      };

      const completions = await getCompletions(situation, dataProvider, timeRange);
      expect(completions).toHaveLength(1);
      expect(completions[0].insertText).toBe('test\\"\\\\value');
    });

    it('should handle non-string values', async () => {
      jest.spyOn(dataProvider, 'getLabelValues').mockResolvedValue([123 as unknown as string]);

      const situation: Situation = {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        labelName: 'testLabel',
        betweenQuotes: false,
        otherLabels: [],
      };

      const completions = await getCompletions(situation, dataProvider, timeRange);
      expect(completions).toHaveLength(1);
      expect(completions[0].insertText).toBe('"123"');
    });
  });
});
