import { CustomVariableModel } from '@grafana/data';
import { Monaco, monacoTypes } from '@grafana/ui';

import { setupMockedTemplateService, logGroupNamesVariable } from '../../../__mocks__/CloudWatchDataSource';
import { multiLineFullQuery } from '../../../__mocks__/cloudwatch-logs-sql-test-data/multiLineFullQuery';
import { multiLineFullQueryWithCaseClause } from '../../../__mocks__/cloudwatch-logs-sql-test-data/multiLineFullQueryWithCaseClause';
import { partialQueryWithSubquery } from '../../../__mocks__/cloudwatch-logs-sql-test-data/partialQueryWithSubquery';
import { singleLineFullQuery } from '../../../__mocks__/cloudwatch-logs-sql-test-data/singleLineFullQuery';
import { whitespaceQuery } from '../../../__mocks__/cloudwatch-logs-sql-test-data/whitespaceQuery';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import { ResourcesAPI } from '../../../resources/ResourcesAPI';
import { ResourceResponse } from '../../../resources/types';
import { LogGroup, LogGroupField } from '../../../types';
import cloudWatchLogsLanguageDefinition from '../definition';
import {
  SELECT,
  ALL,
  DISTINCT,
  ALL_FUNCTIONS,
  FROM,
  BY,
  WHERE,
  GROUP,
  ORDER,
  LIMIT,
  INNER,
  LEFT,
  OUTER,
  JOIN,
  ON,
  HAVING,
  PREDICATE_OPERATORS,
  LOGICAL_OPERATORS,
  ASC,
  DESC,
  CASE,
  WHEN,
  THEN,
  ELSE,
  END,
} from '../language';

import { LogsSQLCompletionItemProvider } from './CompletionItemProvider';

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
  const setup = new LogsSQLCompletionItemProvider(
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

describe('LogsSQLCompletionItemProvider', () => {
  describe('getSuggestions', () => {
    it('returns select keyword for an empty query', async () => {
      const suggestions = await getSuggestions(whitespaceQuery.query, { lineNumber: 1, column: 0 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([SELECT]));
    });

    it('returns `ALL`, `DISTINCT`, `CASE`, keywords and all functions after select keyword', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 7 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([ALL, DISTINCT, CASE, ...ALL_FUNCTIONS]));
    });

    it('returns `CASE` keyword and all functions for a select expression', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 37 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([CASE, ...ALL_FUNCTIONS]));
    });

    it('returns `FROM`, `CASE` keywords and all functions after a select expression', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 103 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining([FROM, `${FROM} \`logGroups(logGroupIdentifier: [...])\``, CASE, ...ALL_FUNCTIONS])
      );
    });

    it('returns logGroups suggestion after from keyword', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 108 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(['`logGroups(logGroupIdentifier: [...])`']));
    });

    it('returns where, having, limit, group by, order by, and join suggestions after from arguments', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 125 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining([
          WHERE,
          HAVING,
          LIMIT,
          `${GROUP} ${BY}`,
          `${ORDER} ${BY}`,
          `${INNER} ${JOIN} <log group> ${ON} <field>`,
          `${LEFT} ${OUTER} ${JOIN} <log group> ${ON} <field>`,
        ])
      );
    });

    it('returns `CASE` keyword and all functions for a where key', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 182 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([CASE, ...ALL_FUNCTIONS]));
    });

    it('returns predicate operators after a where key', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 191 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(PREDICATE_OPERATORS));
    });

    it('returns all functions after a where comparison operator', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 193 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns logical operators, group by, order by, and limit keywords after a where value', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 201 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining([...LOGICAL_OPERATORS, LIMIT, `${GROUP} ${BY}`, `${ORDER} ${BY}`])
      );
    });

    it('returns all functions for a having key', async () => {
      const suggestions = await getSuggestions(multiLineFullQuery.query, { lineNumber: 8, column: 7 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns predicate operators after a having key', async () => {
      const suggestions = await getSuggestions(multiLineFullQuery.query, { lineNumber: 8, column: 13 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(PREDICATE_OPERATORS));
    });

    it('returns all functions after a having comparison operator', async () => {
      const suggestions = await getSuggestions(multiLineFullQuery.query, { lineNumber: 8, column: 15 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns logical operators, order by, and limit keywords after a having value', async () => {
      const suggestions = await getSuggestions(multiLineFullQuery.query, { lineNumber: 8, column: 18 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([...LOGICAL_OPERATORS, LIMIT, `${ORDER} ${BY}`]));
    });

    it('returns all functions for an on key', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 156 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns predicate operators after an on key', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 165 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(PREDICATE_OPERATORS));
    });

    it('returns all functions after an on comparison operator', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 167 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns logical operators, group by, order by, and limit keywords after an on value', async () => {
      const suggestions = await getSuggestions(singleLineFullQuery.query, { lineNumber: 1, column: 176 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(
        expect.arrayContaining([...LOGICAL_OPERATORS, LIMIT, `${GROUP} ${BY}`, `${ORDER} ${BY}`])
      );
    });

    it('returns `WHEN` keyword and all functions for a case key', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 9, column: 5 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([WHEN, ...ALL_FUNCTIONS]));
    });

    it('returns `WHEN` keyword and predicate operators after a case key', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 9, column: 7 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([WHEN, ...PREDICATE_OPERATORS]));
    });

    it('returns all functions after a case comparison operator', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 9, column: 9 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns `WHEN` keyword after a case value', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 9, column: 11 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([WHEN]));
    });

    it('returns all functions for a when key', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 5 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns `THEN` keyword and predicate operators after a when key', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 8 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([THEN, ...PREDICATE_OPERATORS]));
    });

    it('returns all functions after a when comparison operator', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 10 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns `THEN` keyword after a when value', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 14 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([THEN]));
    });

    it('returns all functions after a then keyword', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 19 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns `WHEN`, `ELSE`, and `END` keywords after a then expression', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 29 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([WHEN, `${ELSE} ... ${END}`]));
    });

    it('returns all functions after an else keyword', async () => {
      const suggestions = await getSuggestions(multiLineFullQueryWithCaseClause.query, { lineNumber: 5, column: 5 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns all functions after group by keywords', async () => {
      const suggestions = await getSuggestions(multiLineFullQuery.query, { lineNumber: 7, column: 9 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(ALL_FUNCTIONS));
    });

    it('returns having, limit, order by suggestions after group by', async () => {
      const suggestions = await getSuggestions(multiLineFullQuery.query, { lineNumber: 7, column: 27 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([HAVING, LIMIT, `${ORDER} ${BY}`]));
    });

    it('returns order directions and limit keywords after order by keywords', async () => {
      const suggestions = await getSuggestions(multiLineFullQuery.query, { lineNumber: 9, column: 9 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([LIMIT, ASC, DESC]));
    });

    it('returns limit keyword after order by direction', async () => {
      const suggestions = await getSuggestions(multiLineFullQuery.query, { lineNumber: 9, column: 26 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([LIMIT]));
    });

    it('returns `SELECT` keyword and all functions at the start of a subquery', async () => {
      const suggestions = await getSuggestions(partialQueryWithSubquery.query, { lineNumber: 1, column: 53 });
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining([SELECT, ...ALL_FUNCTIONS]));
    });

    it('returns template variables appended to list of suggestions', async () => {
      const suggestions = await getSuggestions(whitespaceQuery.query, { lineNumber: 1, column: 0 }, [
        logGroupNamesVariable,
      ]);
      const suggestionLabels = suggestions.map((s) => s.label);
      const expectedTemplateVariableLabel = `$${logGroupNamesVariable.name}`;
      const expectedLabels = [SELECT, expectedTemplateVariableLabel];
      expect(suggestionLabels).toEqual(expect.arrayContaining(expectedLabels));
    });

    it('fetches fields when logGroups are set', async () => {
      const suggestions = await getSuggestions(
        singleLineFullQuery.query,
        { lineNumber: 1, column: 37 },
        [],
        [{ arn: 'foo', name: 'bar' }],
        [{ value: { name: '@field' } }]
      );
      const suggestionLabels = suggestions.map((s) => s.label);
      expect(suggestionLabels).toEqual(expect.arrayContaining(['@field']));
    });
  });
});
