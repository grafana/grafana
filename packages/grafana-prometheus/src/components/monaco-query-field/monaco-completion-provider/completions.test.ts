import { config } from '@grafana/runtime';

import { SUGGESTIONS_LIMIT } from '../../../language_provider';
import { FUNCTIONS } from '../../../promql';

import { getCompletions } from './completions';
import { DataProvider, DataProviderParams } from './data-provider';
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

  it('should enable autocomplete suggestions update when the number of metric names is greater than the limit and there is text input', async () => {
    const situation: Situation = {
      type: situationType,
    };

    // Do not cross the metrics names threshold
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValueOnce(metrics.atLimit);
    dataProvider.monacoSettings.setInputInRange('name_1');
    await getCompletions(situation, dataProvider);
    expect(dataProvider.monacoSettings.suggestionsIncomplete).toBe(false);

    // Cross the metric names threshold, but without text input
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValueOnce(metrics.beyondLimit);
    dataProvider.monacoSettings.setInputInRange('');
    await getCompletions(situation, dataProvider);
    expect(dataProvider.monacoSettings.suggestionsIncomplete).toBe(false);

    // Cross the metric names threshold, with text input
    jest.spyOn(dataProvider, 'getAllMetricNames').mockReturnValueOnce(metrics.beyondLimit);
    dataProvider.monacoSettings.setInputInRange('name_1');
    await getCompletions(situation, dataProvider);
    expect(dataProvider.monacoSettings.suggestionsIncomplete).toBe(true);
  });
});
