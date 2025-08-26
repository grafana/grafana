import { monacoTypes } from '@grafana/ui';

import { logsTestDataCommentOnlyQuery } from '../../../mocks/cloudwatch-logs-test-data/commentOnlyQuery';
import { logsTestDataEmptyQuery } from '../../../mocks/cloudwatch-logs-test-data/empty';
import { logsTestDataMultiLineFullQuery } from '../../../mocks/cloudwatch-logs-test-data/multiLineFullQuery';
import { logsTestDataSingleLineFullQuery } from '../../../mocks/cloudwatch-logs-test-data/singleLineFullQuery';
import { logsTestDataWhitespaceOnlyQuery } from '../../../mocks/cloudwatch-logs-test-data/whitespaceQuery';
import MonacoMock from '../../../mocks/monarch/Monaco';
import TextModel from '../../../mocks/monarch/TextModel';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import { StatementPosition } from '../../monarch/types';
import cloudWatchLogsLanguageDefinition from '../definition';

import { getStatementPosition } from './statementPosition';
import { LogsTokenTypes } from './types';

function generateToken(query: string, position: monacoTypes.IPosition) {
  const testModel = TextModel(query);
  return linkedTokenBuilder(
    MonacoMock,
    cloudWatchLogsLanguageDefinition,
    testModel as monacoTypes.editor.ITextModel,
    position,
    LogsTokenTypes
  );
}

describe('getStatementPosition', () => {
  it('should return StatementPosition.NewCommand the current token is null', () => {
    expect(getStatementPosition(null)).toEqual(StatementPosition.NewCommand);
  });

  it('should return StatementPosition.NewCommand for an empty query', () => {
    expect(getStatementPosition(generateToken(logsTestDataEmptyQuery.query, { lineNumber: 1, column: 1 }))).toEqual(
      StatementPosition.NewCommand
    );
  });

  it('should return StatementPosition.NewCommand for a query that is only whitespace', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataWhitespaceOnlyQuery.query, { lineNumber: 1, column: 1 }))
    ).toEqual(StatementPosition.NewCommand);
  });

  it('should return StatementPosition.Comment for a query with only a comment', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataCommentOnlyQuery.query, { lineNumber: 1, column: 1 }))
    ).toEqual(StatementPosition.Comment);
  });

  it('should return StatementPosition.NewCommand after a `|`', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 30 }))
    ).toEqual(StatementPosition.NewCommand);
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 2 }))
    ).toEqual(StatementPosition.NewCommand);
  });

  it('should return StatementPosition.FieldsKeyword inside the `fields` keyword', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 6 }))
    ).toEqual(StatementPosition.FieldsKeyword);
  });

  it('should return StatementPosition.AfterFieldsKeyword after the `fields` keyword', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 7 }))
    ).toEqual(StatementPosition.AfterFieldsKeyword);
  });

  it('should return StatementPosition.CommandArg after a keyword', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 8 }))
    ).toEqual(StatementPosition.CommandArg);
  });

  it('should return StatementPosition.AfterCommand after a function', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 49 }))
    ).toEqual(StatementPosition.AfterCommand);
  });

  it('should return StatementPosition.Function within a function', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 9 }))
    ).toEqual(StatementPosition.Function);
  });

  it('should return StatementPosition.FunctionArg when providing arguments to a function', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 16 }))
    ).toEqual(StatementPosition.FunctionArg);
  });

  it('should return StatementPosition.AfterFunction after a function', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 64 }))
    ).toEqual(StatementPosition.AfterFunction);
  });

  it('should return StatementPosition.ArithmeticOperatorArg after an arithmetic operator', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 51 }))
    ).toEqual(StatementPosition.ArithmeticOperatorArg);
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 58 }))
    ).toEqual(StatementPosition.ArithmeticOperatorArg);
  });

  it('should return StatementPosition.BooleanOperatorArg after a boolean operator', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 37 }))
    ).toEqual(StatementPosition.BooleanOperatorArg);
  });

  it('should return StatementPosition.ComparisonOperatorArg after a comparison operator', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 44 }))
    ).toEqual(StatementPosition.ComparisonOperatorArg);
  });

  it('should return StatementPosition.ArithmeticOperator after an arithmetic operator', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 50 }))
    ).toEqual(StatementPosition.ArithmeticOperator);
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 4, column: 57 }))
    ).toEqual(StatementPosition.ArithmeticOperator);
  });

  it('should return StatementPosition.BooleanOperator after a boolean operator', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 35 }))
    ).toEqual(StatementPosition.BooleanOperator);
  });

  it('should return StatementPosition.ComparisonOperator after a comparison operator', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 2, column: 43 }))
    ).toEqual(StatementPosition.ComparisonOperator);
  });

  it('should return StatementPosition.Comment when token is a comment', () => {
    expect(
      getStatementPosition(generateToken(logsTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 40 }))
    ).toEqual(StatementPosition.Comment);
    expect(
      getStatementPosition(generateToken(logsTestDataCommentOnlyQuery.query, { lineNumber: 1, column: 35 }))
    ).toEqual(StatementPosition.Comment);
    expect(
      getStatementPosition(generateToken(logsTestDataMultiLineFullQuery.query, { lineNumber: 5, column: 3 }))
    ).toEqual(StatementPosition.Comment);
  });
});
