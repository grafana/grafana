import { CompletionItemPriority } from '@grafana/plugin-ui';
import { Monaco, monacoTypes } from '@grafana/ui';

import { dynamicLabelTestDataAfterLabelValue } from '../../mocks/dynamic-label-test-data/afterLabelValue';
import { dynamicLabelTestDataInsideLabelValue } from '../../mocks/dynamic-label-test-data/insideLabelValue';
import MonacoMock from '../../mocks/monarch/Monaco';
import TextModel from '../../mocks/monarch/TextModel';

import { DynamicLabelsCompletionItemProvider } from './CompletionItemProvider';
import cloudWatchDynamicLabelsLanguageDefinition from './definition';
import { DYNAMIC_LABEL_PATTERNS } from './language';

const getSuggestions = async (value: string, position: monacoTypes.IPosition) => {
  const setup = new DynamicLabelsCompletionItemProvider();
  const monaco = MonacoMock as Monaco;
  const provider = setup.getCompletionProvider(monaco, cloudWatchDynamicLabelsLanguageDefinition);
  const { suggestions } = await provider.provideCompletionItems(
    TextModel(value) as monacoTypes.editor.ITextModel,
    position
  );
  return suggestions;
};

describe('Dynamic labels: CompletionItemProvider', () => {
  describe('getSuggestions', () => {
    it('returns all dynamic labels in case current token is a whitespace', async () => {
      const { query, position } = dynamicLabelTestDataAfterLabelValue;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toEqual(DYNAMIC_LABEL_PATTERNS.length + 1); // + 1 for the dimension suggestions
    });

    it('should return suggestion for dimension label that has high prio', async () => {
      const { query, position } = dynamicLabelTestDataAfterLabelValue;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toBeTruthy();
      const highPrioSuggestsions = suggestions.filter((s) => s.sortText === CompletionItemPriority.High);
      expect(highPrioSuggestsions.length).toBe(1);
      expect(highPrioSuggestsions[0].label).toBe("${PROP('Dim.')}");
    });

    it('doesnt return suggestions if cursor is inside a dynamic label', async () => {
      const { query, position } = dynamicLabelTestDataInsideLabelValue;
      const suggestions = await getSuggestions(query, position);
      expect(suggestions.length).toBe(0);
    });
  });
});
