import { CustomVariableModel } from '@grafana/data';
import { Monaco, monacoTypes } from '@grafana/ui';

import { setupMockedTemplateService, logGroupNamesVariable } from '../../../__mocks__/CloudWatchDataSource';
import { emptyQuery, filterQuery, newCommandQuery, sortQuery } from '../../../__mocks__/cloudwatch-logs-test-data';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import { ResourcesAPI } from '../../../resources/ResourcesAPI';
import cloudWatchLogsLanguageDefinition from '../definition';
import { LOGS_COMMANDS, LOGS_FUNCTION_OPERATORS, SORT_DIRECTION_KEYWORDS } from '../language';

import { LogsCompletionItemProvider } from './CompletionItemProvider';

jest.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
  Token: jest.fn((offset, type, language) => ({ offset, type, language })),
}));

const getSuggestions = async (
  value: string,
  position: monacoTypes.IPosition,
  variables: CustomVariableModel[] = []
) => {
  const setup = new LogsCompletionItemProvider(
    {
      getActualRegion: () => 'us-east-2',
    } as ResourcesAPI,
    setupMockedTemplateService(variables)
  );
  const monaco = MonacoMock as Monaco;
  const provider = setup.getCompletionProvider(monaco, cloudWatchLogsLanguageDefinition);
  const { suggestions } = await provider.provideCompletionItems(
    TextModel(value) as monacoTypes.editor.ITextModel,
    position
  );
  return suggestions;
};

describe('LogsCompletionItemProvider', () => {
  describe('getSuggestions', () => {
    it('returns commands for an empty query', async () => {
      const suggestions = await getSuggestions(emptyQuery.query, emptyQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(LOGS_COMMANDS));
    });

    it('returns commands for a query when a new command is started', async () => {
      const suggestions = await getSuggestions(newCommandQuery.query, newCommandQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(LOGS_COMMANDS));
    });

    it('returns sort order directions for the sort keyword', async () => {
      const suggestions = await getSuggestions(sortQuery.query, sortQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(SORT_DIRECTION_KEYWORDS));
    });

    it('returns function suggestions after a command', async () => {
      const suggestions = await getSuggestions(sortQuery.query, sortQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(LOGS_FUNCTION_OPERATORS));
    });

    it('returns `in []` snippet for the `in` keyword', async () => {
      const suggestions = await getSuggestions(filterQuery.query, filterQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(['in []']));
    });

    it('returns template variables appended to list of suggestions', async () => {
      const suggestions = await getSuggestions(newCommandQuery.query, newCommandQuery.position, [
        logGroupNamesVariable,
      ]);
      const suggestionLabels = suggestions.map((s) => s.label);
      const expectedTemplateVariableLabel = `$${logGroupNamesVariable.name}`;
      const expectedLabels = [...LOGS_COMMANDS, expectedTemplateVariableLabel];
      expect(suggestionLabels).toEqual(expect.arrayContaining(expectedLabels));
    });
  });
});
