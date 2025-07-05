import { CustomVariableModel } from '@grafana/data';
import { Monaco, monacoTypes } from '@grafana/ui';

import { setupMockedTemplateService, logGroupNamesVariable } from '../../../mocks/CloudWatchDataSource';
import { logsTestDataEmptyQuery } from '../../../mocks/cloudwatch-logs-test-data/empty';
import { logsTestDataFilterQuery } from '../../../mocks/cloudwatch-logs-test-data/filterQuery';
import { logsTestDataNewCommandQuery } from '../../../mocks/cloudwatch-logs-test-data/newCommandQuery';
import { logsTestDataSortQuery } from '../../../mocks/cloudwatch-logs-test-data/sortQuery';
import MonacoMock from '../../../mocks/monarch/Monaco';
import TextModel from '../../../mocks/monarch/TextModel';
import { ResourcesAPI } from '../../../resources/ResourcesAPI';
import { ResourceResponse } from '../../../resources/types';
import { LogGroup, LogGroupField } from '../../../types';
import cloudWatchLogsLanguageDefinition from '../definition';
import { LOGS_COMMANDS, LOGS_FUNCTION_OPERATORS, SORT_DIRECTION_KEYWORDS } from '../language';

import { LogsCompletionItemProvider } from './CompletionItemProvider';

jest.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
  Token: jest.fn((offset, type, language) => ({ offset, type, language })),
}));

const getSuggestions = async (
  value: string,
  position: monacoTypes.IPosition,
  variables: CustomVariableModel[] = [],
  logGroups: LogGroup[] = [],
  fields: Array<ResourceResponse<LogGroupField>> = []
) => {
  const setup = new LogsCompletionItemProvider(
    {
      getActualRegion: () => 'us-east-2',
    } as ResourcesAPI,
    setupMockedTemplateService(variables),
    { region: 'default', logGroups }
  );

  setup.resources.getLogGroupFields = jest.fn().mockResolvedValue(fields);
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
      const suggestions = await getSuggestions(logsTestDataEmptyQuery.query, logsTestDataEmptyQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(LOGS_COMMANDS));
    });

    it('returns commands for a query when a new command is started', async () => {
      const suggestions = await getSuggestions(logsTestDataNewCommandQuery.query, logsTestDataNewCommandQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(LOGS_COMMANDS));
    });

    it('returns sort order directions for the sort keyword', async () => {
      const suggestions = await getSuggestions(logsTestDataSortQuery.query, logsTestDataSortQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(SORT_DIRECTION_KEYWORDS));
    });

    it('returns function suggestions after a command', async () => {
      const suggestions = await getSuggestions(logsTestDataSortQuery.query, logsTestDataSortQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(LOGS_FUNCTION_OPERATORS));
    });

    it('returns `in []` snippet for the `in` keyword', async () => {
      const suggestions = await getSuggestions(logsTestDataFilterQuery.query, logsTestDataFilterQuery.position);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(['in []']));
    });

    it('returns template variables appended to list of suggestions', async () => {
      const suggestions = await getSuggestions(
        logsTestDataNewCommandQuery.query,
        logsTestDataNewCommandQuery.position,
        [logGroupNamesVariable]
      );
      const suggestionLabels = suggestions.map((s) => s.label);
      const expectedTemplateVariableLabel = `$${logGroupNamesVariable.name}`;
      const expectedLabels = [...LOGS_COMMANDS, expectedTemplateVariableLabel];
      expect(suggestionLabels).toEqual(expect.arrayContaining(expectedLabels));
    });

    it('fetches fields when logGroups are set', async () => {
      const suggestions = await getSuggestions(
        logsTestDataSortQuery.query,
        logsTestDataSortQuery.position,
        [],
        [{ arn: 'foo', name: 'bar' }],
        [{ value: { name: '@field' } }]
      );
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(['@field']));
    });
  });
});
