import { Monaco, monacoTypes } from '@grafana/ui';

import { setupMockedTemplateService } from '../../../mocks/CloudWatchDataSource';
import { afterFunctionQuery } from '../../../mocks/metric-math-test-data/afterFunctionQuery';
import { secondArgAfterSearchQuery } from '../../../mocks/metric-math-test-data/secondArgAfterSearchQuery';
import { secondArgQuery } from '../../../mocks/metric-math-test-data/secondArgQuery';
import { singleLineEmptyQuery } from '../../../mocks/metric-math-test-data/singleLineEmptyQuery';
import { thirdArgAfterSearchQuery } from '../../../mocks/metric-math-test-data/thirdArgAfterSearchQuery';
import { withinStringQuery } from '../../../mocks/metric-math-test-data/withinStringQuery';
import MonacoMock from '../../../mocks/monarch/Monaco';
import TextModel from '../../../mocks/monarch/TextModel';
import { ResourcesAPI } from '../../../resources/ResourcesAPI';
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
    } as ResourcesAPI,
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
      const { query, position } = singleLineEmptyQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(METRIC_MATH_FNS.length);
    });

    it('returns a suggestion for every metric math operator when at the end of a function', async () => {
      const { query, position } = afterFunctionQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(METRIC_MATH_OPERATORS.length);
    });

    it('returns a suggestion for every metric math function and keyword if at the start of the second argument of a function', async () => {
      const { query, position } = secondArgQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(METRIC_MATH_FNS.length + METRIC_MATH_KEYWORDS.length);
    });

    it('does not have any particular suggestions if within a string', async () => {
      const { query, position } = withinStringQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(0);
    });

    it('returns a suggestion for every statistic if the second arg of a search function', async () => {
      const { query, position } = secondArgAfterSearchQuery;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(METRIC_MATH_STATISTIC_KEYWORD_STRINGS.length);
    });

    it('returns a suggestion for every period if the third arg of a search function', async () => {
      const { query, position } = thirdArgAfterSearchQuery;
      const suggestions = await getSuggestions(query, position);
      // +1 because one suggestion is also added for the  $__period_auto macro
      const expectedSuggestionsLength = METRIC_MATH_PERIODS.length + 1;
      expect(suggestions.length).toEqual(expectedSuggestionsLength);
    });
  });
});
