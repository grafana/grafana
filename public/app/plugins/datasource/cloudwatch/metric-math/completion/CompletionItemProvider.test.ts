import { Monaco, monacoTypes } from '@grafana/ui';

import { setupMockedTemplateService } from '../../__mocks__/CloudWatchDataSource';
import * as MetricMathTestData from '../../__mocks__/metric-math-test-data';
import MonacoMock from '../../__mocks__/monarch/Monaco';
import TextModel from '../../__mocks__/monarch/TextModel';
import { CloudWatchAPI } from '../../api';
import cloudWatchMetricMathLanguageDefinition from '../definition';
import {
  METRIC_MATH_FNS,
  METRIC_MATH_KEYWORDS,
  METRIC_MATH_OPERATORS,
  METRIC_MATH_PERIODS,
  METRIC_MATH_STATISTIC_KEYWORD_STRINGS,
} from '../language';

import { MetricMathCompletionItemProvider } from './CompletionItemProvider';

const getSuggestions = async (value: string, position: monacoTypes.IPosition) => {
  const setup = new MetricMathCompletionItemProvider(
    {
      getActualRegion: () => 'us-east-2',
    } as CloudWatchAPI,
    setupMockedTemplateService([])
  );
  const monaco = MonacoMock as Monaco;
  const provider = setup.getCompletionProvider(monaco, cloudWatchMetricMathLanguageDefinition);
  const { suggestions } = await provider.provideCompletionItems(
    TextModel(value) as monacoTypes.editor.ITextModel,
    position
  );
  return suggestions;
};
describe('MetricMath: CompletionItemProvider', () => {
  describe('getSuggestions', () => {
    it('returns a suggestion for every metric math function when the input field is empty', async () => {
      const { query, position } = MetricMathTestData.singleLineEmptyQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(METRIC_MATH_FNS.length);
    });

    it('returns a suggestion for every metric math operator when at the end of a function', async () => {
      const { query, position } = MetricMathTestData.afterFunctionQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(METRIC_MATH_OPERATORS.length);
    });

    it('returns a suggestion for every metric math function and keyword if at the start of the second argument of a function', async () => {
      const { query, position } = MetricMathTestData.secondArgQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(METRIC_MATH_FNS.length + METRIC_MATH_KEYWORDS.length);
    });

    it('does not have any particular suggestions if within a string', async () => {
      const { query, position } = MetricMathTestData.withinStringQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(0);
    });

    it('returns a suggestion for every statistic if the second arg of a search function', async () => {
      const { query, position } = MetricMathTestData.secondArgAfterSearchQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(METRIC_MATH_STATISTIC_KEYWORD_STRINGS.length);
    });

    it('returns a suggestion for every period if the third arg of a search function', async () => {
      const { query, position } = MetricMathTestData.thirdArgAfterSearchQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(METRIC_MATH_PERIODS.length);
    });
  });
});
