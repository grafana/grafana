import { monacoTypes } from '@grafana/ui';

import { sqlTestDataMultiLineFullQuery } from '../../../mocks/cloudwatch-sql-test-data/multiLineFullQuery';
import { sqlTestDataSingleLineEmptyQuery } from '../../../mocks/cloudwatch-sql-test-data/singleLineEmptyQuery';
import { sqlTestDataSingleLineFullQuery } from '../../../mocks/cloudwatch-sql-test-data/singleLineFullQuery';
import { sqlTestDataSingleLineTwoQueries } from '../../../mocks/cloudwatch-sql-test-data/singleLineTwoQueries';
import MonacoMock from '../../../mocks/monarch/Monaco';
import TextModel from '../../../mocks/monarch/TextModel';
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
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 0 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 1, column: 0 }],
    [sqlTestDataSingleLineEmptyQuery.query, { lineNumber: 1, column: 0 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 154 }],
  ])('should be before select keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.SelectKeyword);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 7 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 1, column: 7 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 161 }],
  ])('should be after select keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterSelectKeyword);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 12 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 1, column: 12 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 166 }],
  ])('should be first argument in select statistic function', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterSelectFuncFirstArgument);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 27 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 0 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 181 }],
  ])('should be before the FROM keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.FromKeyword);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 32 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 5 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 186 }],
  ])('should after the FROM keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterFromKeyword);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 40 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 13 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 40 }],
  ])('should be namespace arg in the schema func', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.SchemaFuncFirstArgument);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 50 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 23 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 50 }],
  ])('should be label key args within the schema func', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.SchemaFuncExtraArgument);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 63 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 3, column: 0 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 63 }],
  ])('should be after from schema/namespace', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterFrom);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 69 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 6 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 69 }],
  ])('should after where keyword and before label key', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.WhereKey);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 79 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 17 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 79 }],
  ])('should be before the comparison operator in a where filter', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.WhereComparisonOperator);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 81 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 19 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 81 }],
  ])('should be before or in the value in a where filter', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.WhereValue);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 105 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 5, column: 0 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 105 }],
  ])('should be after a where value', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterWhereValue);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 115 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 5, column: 10 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 115 }],
  ])('should be after group by keywords', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterGroupByKeywords);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 123 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 5, column: 22 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 123 }],
  ])('should be after group by labels', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterGroupBy);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 132 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 5, column: 31 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 132 }],
  ])('should be after order by keywords', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterOrderByKeywords);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 138 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 5, column: 37 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 138 }],
  ])('should be after order by function', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterOrderByFunction);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 143 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 6, column: 0 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 145 }],
  ])('should be after order by direction', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterOrderByDirection);
  });
});
