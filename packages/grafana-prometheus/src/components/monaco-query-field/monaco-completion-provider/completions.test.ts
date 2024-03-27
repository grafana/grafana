import { SUGGESTIONS_LIMIT } from '../../../language_provider';
import { FUNCTIONS } from '../../../promql';

import { getCompletions, type DataProvider } from './completions';
import type { Situation } from './situation';

const history: string[] = [];
const getAllMetricNames = jest.fn();
const dataProvider: DataProvider = {
  getAllMetricNames,
  getAllLabelNames: jest.fn(),
  getLabelValues: jest.fn(),
  getSeriesValues: jest.fn(),
  getHistory: jest.fn().mockResolvedValue(history),
  getSeriesLabels: jest.fn(),
};

beforeEach(() => {
  getAllMetricNames.mockReset();
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
  it('should return completions for all metric names when the number of metric names is below the suggestion limit', async () => {
    const metricNamesCount = SUGGESTIONS_LIMIT - 1;
    getAllMetricNames.mockResolvedValue(
      Array.from(Array(metricNamesCount), (_, i) => ({
        name: `metric_name_${i}`,
        type: 'type',
        help: 'metric_name help',
      }))
    );
    const expectedCompletionsCount = getSuggestionCountForSituation(situationType, metricNamesCount);
    const situation: Situation = {
      type: situationType,
    };

    // No text input
    let completions = await getCompletions(situation, dataProvider, '', () => {});
    expect(completions).toHaveLength(expectedCompletionsCount);

    // With text input (use fuzzy search)
    completions = await getCompletions(situation, dataProvider, 'name_1', () => {});
    expect(completions?.length).toBeLessThanOrEqual(expectedCompletionsCount);
  });

  it('should limit completions for metric names when the number of metric names is above the suggestion limit', async () => {
    const metricNamesCount = SUGGESTIONS_LIMIT + 1;
    const situation: Situation = {
      type: situationType,
    };
    const expectedCompletionsCount = getSuggestionCountForSituation(situationType, metricNamesCount);
    getAllMetricNames.mockResolvedValue(
      Array.from(Array(metricNamesCount), (_, i) => ({
        name: `metric_name_${i}`,
        type: 'type',
        help: 'metric_name help',
      }))
    );

    // No text input
    let completions = await getCompletions(situation, dataProvider, '', () => {});
    expect(completions).toHaveLength(expectedCompletionsCount);

    // With text input (use fuzzy search)
    completions = await getCompletions(situation, dataProvider, 'name_1', () => {});
    expect(completions?.length).toBeLessThanOrEqual(expectedCompletionsCount);
  });

  it('should enable autocomplete suggestions update when the number of metric names is above the suggestion limit and there is text input', async () => {
    const enable = jest.fn();

    const situation: Situation = {
      type: situationType,
    };

    // Do not cross the metrics names threshold
    getAllMetricNames.mockResolvedValueOnce(
      Array.from(Array(SUGGESTIONS_LIMIT - 1), (_, i) => ({
        name: `metric_name_${i}`,
        type: 'type',
        help: 'metric_name help',
      }))
    );
    await getCompletions(situation, dataProvider, 'name_1', enable);
    expect(enable).not.toHaveBeenCalled();

    // Cross the metric names threshold, but without text input
    getAllMetricNames.mockResolvedValueOnce(
      Array.from(Array(SUGGESTIONS_LIMIT + 1), (_, i) => ({
        name: `metric_name_${i}`,
        type: 'type',
        help: 'metric_name help',
      }))
    );
    await getCompletions(situation, dataProvider, '', enable);
    expect(enable).not.toHaveBeenCalled();

    // Cross the metric names threshold, with text input
    getAllMetricNames.mockResolvedValueOnce(
      Array.from(Array(SUGGESTIONS_LIMIT + 1), (_, i) => ({
        name: `metric_name_${i}`,
        type: 'type',
        help: 'metric_name help',
      }))
    );
    await getCompletions(situation, dataProvider, 'name_1', () => {});
    expect(getAllMetricNames).toHaveBeenCalled();
  });
});
