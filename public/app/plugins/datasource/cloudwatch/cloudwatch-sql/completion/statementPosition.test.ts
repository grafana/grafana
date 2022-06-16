import { monacoTypes } from '@grafana/ui';

import {
  multiLineFullQuery,
  singleLineFullQuery,
  singleLineEmptyQuery,
  singleLineTwoQueries,
} from '../../__mocks__/cloudwatch-sql-test-data';
import MonacoMock from '../../__mocks__/monarch/Monaco';
import TextModel from '../../__mocks__/monarch/TextModel';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import { StatementPosition } from '../../monarch/types';
import cloudWatchSqlLanguageDefinition from '../definition';

import { getStatementPosition } from './statementPosition';
import { SQLTokenTypes } from './types';

describe('statementPosition', () => {
  function assertPosition(query: string, position: monacoTypes.IPosition, expected: StatementPosition) {
    const testModel = TextModel(query);
    const current = linkedTokenBuilder(
      MonacoMock,
      cloudWatchSqlLanguageDefinition,
      testModel as monacoTypes.editor.ITextModel,
      position,
      SQLTokenTypes
    );
    const statementPosition = getStatementPosition(current);
    expect(statementPosition).toBe(expected);
  }
  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 0 }],
    [multiLineFullQuery.query, { lineNumber: 1, column: 0 }],
    [singleLineEmptyQuery.query, { lineNumber: 1, column: 0 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 154 }],
  ])('should be before select keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.SelectKeyword);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 7 }],
    [multiLineFullQuery.query, { lineNumber: 1, column: 7 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 161 }],
  ])('should be after select keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterSelectKeyword);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 12 }],
    [multiLineFullQuery.query, { lineNumber: 1, column: 12 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 166 }],
  ])('should be first argument in select statistic function', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterSelectFuncFirstArgument);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 27 }],
    [multiLineFullQuery.query, { lineNumber: 2, column: 0 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 181 }],
  ])('should be before the FROM keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.FromKeyword);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 32 }],
    [multiLineFullQuery.query, { lineNumber: 2, column: 5 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 186 }],
  ])('should after the FROM keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterFromKeyword);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 40 }],
    [multiLineFullQuery.query, { lineNumber: 2, column: 13 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 40 }],
  ])('should be namespace arg in the schema func', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.SchemaFuncFirstArgument);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 50 }],
    [multiLineFullQuery.query, { lineNumber: 2, column: 23 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 50 }],
  ])('should be label key args within the schema func', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.SchemaFuncExtraArgument);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 63 }],
    [multiLineFullQuery.query, { lineNumber: 3, column: 0 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 63 }],
  ])('should be after from schema/namespace', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterFrom);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 69 }],
    [multiLineFullQuery.query, { lineNumber: 4, column: 6 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 69 }],
  ])('should after where keyword and before label key', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.WhereKey);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 79 }],
    [multiLineFullQuery.query, { lineNumber: 4, column: 17 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 79 }],
  ])('should be before the comparison operator in a where filter', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.WhereComparisonOperator);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 81 }],
    [multiLineFullQuery.query, { lineNumber: 4, column: 19 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 81 }],
  ])('should be before or in the value in a where filter', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.WhereValue);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 105 }],
    [multiLineFullQuery.query, { lineNumber: 5, column: 0 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 105 }],
  ])('should be after a where value', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterWhereValue);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 115 }],
    [multiLineFullQuery.query, { lineNumber: 5, column: 10 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 115 }],
  ])('should be after group by keywords', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterGroupByKeywords);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 123 }],
    [multiLineFullQuery.query, { lineNumber: 5, column: 22 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 123 }],
  ])('should be after group by labels', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterGroupBy);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 132 }],
    [multiLineFullQuery.query, { lineNumber: 5, column: 31 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 132 }],
  ])('should be after order by keywords', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterOrderByKeywords);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 138 }],
    [multiLineFullQuery.query, { lineNumber: 5, column: 37 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 138 }],
  ])('should be after order by function', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterOrderByFunction);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 143 }],
    [multiLineFullQuery.query, { lineNumber: 6, column: 0 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 145 }],
  ])('should be after order by direction', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterOrderByDirection);
  });
});
