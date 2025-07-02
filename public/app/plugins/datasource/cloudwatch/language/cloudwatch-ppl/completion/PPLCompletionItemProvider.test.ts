import { CustomVariableModel } from '@grafana/data';
import { Monaco, monacoTypes } from '@grafana/ui';

import { logGroupNamesVariable, setupMockedTemplateService } from '../../../mocks/CloudWatchDataSource';
import { newCommandQuery } from '../../../mocks/cloudwatch-ppl-test-data/newCommandQuery';
import {
  dedupQueryWithOptionalArgs,
  emptyQuery,
  evalQuery,
  fieldsQuery,
  headQuery,
  parseQuery,
  queryWithArithmeticOps,
  queryWithFunctionCalls,
  queryWithFieldList,
  sortQuery,
  statsQuery,
  topQuery,
  whereQuery,
} from '../../../mocks/cloudwatch-ppl-test-data/singleLineQueries';
import MonacoMock from '../../../mocks/monarch/Monaco';
import TextModel from '../../../mocks/monarch/TextModel';
import { ResourcesAPI } from '../../../resources/ResourcesAPI';
import { ResourceResponse } from '../../../resources/types';
import { LogGroup, LogGroupField } from '../../../types';
import cloudWatchLogsPPLLanguageDefinition from '../definition';
import {
  BOOLEAN_LITERALS,
  CONDITION_FUNCTIONS,
  DEDUP_PARAMETERS,
  EVAL_FUNCTIONS,
  FIELD_OPERATORS,
  NOT,
  PPL_COMMANDS,
  PPL_FUNCTIONS,
  SORT_FIELD_FUNCTIONS,
  SPAN,
  STATS_PARAMETERS,
  STATS_FUNCTIONS,
  FROM,
} from '../language';

import { PPLCompletionItemProvider } from './PPLCompletionItemProvider';

jest.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
  Token: jest.fn((offset, type, language) => ({ offset, type, language })),
}));

const logFields = [{ value: { name: '@field' } }, { value: { name: '@message' } }];
const logFieldNames = ['@field', '@message'];
const logGroups = [{ arn: 'foo', name: 'bar' }];

const getSuggestions = async (
  value: string,
  position: monacoTypes.IPosition,
  variables: CustomVariableModel[] = [],
  logGroups: LogGroup[] = [],
  fields: Array<ResourceResponse<LogGroupField>> = []
) => {
  const setup = new PPLCompletionItemProvider({} as ResourcesAPI, setupMockedTemplateService(variables), {
    region: 'default',
    logGroups,
  });

  setup.resources.getLogGroupFields = jest.fn().mockResolvedValue(fields);
  const monaco = MonacoMock as Monaco;
  const provider = setup.getCompletionProvider(monaco, cloudWatchLogsPPLLanguageDefinition);
  const { suggestions } = await provider.provideCompletionItems(
    TextModel(value) as monacoTypes.editor.ITextModel,
    position
  );
  return suggestions;
};

describe('PPLCompletionItemProvider', () => {
  describe('getSuggestions', () => {
    it('should suggest commands for an empty query', async () => {
      const suggestions = await getSuggestions(emptyQuery.query, { lineNumber: 1, column: 1 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(PPL_COMMANDS));
    });

    it('should suggest commands for a query when a new command is started', async () => {
      const suggestions = await getSuggestions(newCommandQuery.query, { lineNumber: 1, column: 20 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(PPL_COMMANDS));
    });

    describe('SuggestionKind.ValueExpression', () => {
      test.each([
        [queryWithFunctionCalls.query, { lineNumber: 1, column: 20 }],
        [queryWithFunctionCalls.query, { lineNumber: 1, column: 59 }],
        [queryWithFunctionCalls.query, { lineNumber: 1, column: 78 }],
        [queryWithArithmeticOps.query, { lineNumber: 1, column: 14 }],
        [whereQuery.query, { lineNumber: 1, column: 71 }],
      ])('should suggest functions and fields as argument for value expression', async (query, position) => {
        const suggestions = await getSuggestions(query, position, [], logGroups, logFields);
        const suggestionLabels = suggestions.map((s) => s.label);
        expect(suggestionLabels).toEqual(expect.arrayContaining([...EVAL_FUNCTIONS, ...logFieldNames]));
      });
    });

    describe('[SuggestioKind.Field]', () => {
      test.each([
        [evalQuery.query, { lineNumber: 1, column: 5 }],
        [fieldsQuery.query, { lineNumber: 1, column: 9 }],
        [topQuery.query, { lineNumber: 1, column: 36 }],
        [queryWithFieldList.query, { lineNumber: 1, column: 22 }],
        [statsQuery.query, { lineNumber: 1, column: 10 }],
      ])('should suggest fields for SuggestionKind.Field', async (query, position) => {
        const suggestions = await getSuggestions(query, position, [], logGroups, logFields);
        const suggestionLabels = suggestions.map((s) => s.label);
        expect(suggestionLabels).toEqual(expect.arrayContaining(logFieldNames));
      });
    });

    it('should suggest from clause after HEAD command', async () => {
      const suggestions = await getSuggestions(headQuery.query, { lineNumber: 1, column: 5 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual([FROM]);
    });

    it('should suggest stats parameters after STATS command', async () => {
      const suggestions = await getSuggestions(statsQuery.query, { lineNumber: 1, column: 6 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([...STATS_PARAMETERS, ...STATS_FUNCTIONS]));
      expect(suggestionLabels).not.toContain('@field');
    });

    it('should suggest fields, field operators and sort functions when in a sort field position', async () => {
      const suggestions = await getSuggestions(sortQuery.query, { lineNumber: 1, column: 5 }, [], logGroups, logFields);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining([...FIELD_OPERATORS, ...SORT_FIELD_FUNCTIONS, ...logFieldNames])
      );
    });

    it('should suggest field operators and fields after FIELDS command', async () => {
      const suggestions = await getSuggestions(
        fieldsQuery.query,
        { lineNumber: 1, column: 7 },
        [],
        logGroups,
        logFields
      );
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([...FIELD_OPERATORS, ...logFieldNames]));
    });

    it('should suggest boolean literals after boolean argument', async () => {
      const suggestions = await getSuggestions(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 53 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining(BOOLEAN_LITERALS.map((booleanLiteral) => `= ${booleanLiteral}`))
      );
    });

    it('should suggest dedup parameters after DEDUP field names', async () => {
      const suggestions = await getSuggestions(dedupQueryWithOptionalArgs.query, { lineNumber: 1, column: 43 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(DEDUP_PARAMETERS));
    });

    it('should suggest fields and span function after STATS BY', async () => {
      const suggestions = await getSuggestions(
        statsQuery.query,
        { lineNumber: 1, column: 42 },
        [],
        logGroups,
        logFields
      );
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([SPAN, ...logFieldNames]));
    });

    it('should suggest fields and sort functions after SORT field operator', async () => {
      const suggestions = await getSuggestions(sortQuery.query, { lineNumber: 1, column: 7 }, [], logGroups, logFields);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([...SORT_FIELD_FUNCTIONS, ...logFieldNames]));
    });

    it('should suggest PPL functions, NOT, case and fields in Expression clauses', async () => {
      const evalSuggestions = await getSuggestions(
        evalQuery.query,
        { lineNumber: 1, column: 21 },
        [],
        logGroups,
        logFields
      );
      const evalSuggestionLabels = evalSuggestions.map((s) => s.label);
      expect(evalSuggestionLabels).toEqual(
        expect.arrayContaining([...PPL_FUNCTIONS, ...EVAL_FUNCTIONS, ...CONDITION_FUNCTIONS, NOT, '@field', '@message'])
      );

      const parseSuggestions = await getSuggestions(
        parseQuery.query,
        { lineNumber: 1, column: 6 },
        [],
        logGroups,
        logFields
      );
      const parseSuggestionLabels = parseSuggestions.map((s) => s.label);
      expect(parseSuggestionLabels).toEqual(
        expect.arrayContaining([...PPL_FUNCTIONS, ...EVAL_FUNCTIONS, ...CONDITION_FUNCTIONS, NOT, '@field', '@message'])
      );
    });

    it('should suggest functions, fields and boolean functions in a logical expression', async () => {
      const suggestions = await getSuggestions(
        whereQuery.query,
        { lineNumber: 1, column: 6 },
        [],
        logGroups,
        logFields
      );
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining([...CONDITION_FUNCTIONS, ...EVAL_FUNCTIONS, '@field', '@message'])
      );
    });

    it('should suggest template variables appended to list of suggestions', async () => {
      const suggestions = await getSuggestions(
        sortQuery.query,
        { lineNumber: 1, column: 7 },
        [logGroupNamesVariable],
        logGroups,
        logFields
      );
      const suggestionLabels = suggestions.map((s) => s.label);
      const expectedTemplateVariableLabel = `$${logGroupNamesVariable.name}`;
      const expectedLabels = [...SORT_FIELD_FUNCTIONS, ...logFieldNames, expectedTemplateVariableLabel];
      expect(suggestionLabels).toEqual(expect.arrayContaining(expectedLabels));
    });

    it('fetches fields when logGroups are set', async () => {
      const suggestions = await getSuggestions(
        whereQuery.query,
        { lineNumber: 1, column: 6 },
        [],
        logGroups,
        logFields
      );
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(logFieldNames));
    });

    it('does not fetch fields when logGroups are not set', async () => {
      const suggestions = await getSuggestions(whereQuery.query, { lineNumber: 1, column: 6 }, [], [], logFields);
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).not.toContain('@field');
    });
  });
});
