import { monacoTypes } from '@grafana/ui';

import { sqlTestDataMultiLineFullQuery } from '../../../mocks/cloudwatch-sql-test-data/multiLineFullQuery';
import { sqlTestDataMultiLineIncompleteQueryWithoutNamespace } from '../../../mocks/cloudwatch-sql-test-data/multiLineIncompleteQueryWithoutNamespace';
import { sqlTestDataSingleLineFullQuery } from '../../../mocks/cloudwatch-sql-test-data/singleLineFullQuery';
import { sqlTestDataSingleLineTwoQueries } from '../../../mocks/cloudwatch-sql-test-data/singleLineTwoQueries';
import MonacoMock from '../../../mocks/monarch/Monaco';
import TextModel from '../../../mocks/monarch/TextModel';
import { LinkedToken } from '../../monarch/LinkedToken';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import cloudWatchSqlLanguageDefinition from '../definition';
import { SELECT } from '../language';

import { getMetricNameToken, getNamespaceToken, getSelectStatisticToken, getSelectToken } from './tokenUtils';
import { SQLTokenTypes } from './types';

const getToken = (
  query: string,
  position: monacoTypes.IPosition,
  invokeFunction: (token: LinkedToken | null) => LinkedToken | null
) => {
  const testModel = TextModel(query);
  const current = linkedTokenBuilder(
    MonacoMock,
    cloudWatchSqlLanguageDefinition,
    testModel as monacoTypes.editor.ITextModel,
    position,
    SQLTokenTypes
  );
  return invokeFunction(current);
};

describe('tokenUtils', () => {
  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 50 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 5, column: 10 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 30 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 185 }],
  ])('getSelectToken should return the right token', (query: string, position: monacoTypes.IPosition) => {
    const token = getToken(query, position, getSelectToken);
    expect(token).not.toBeNull();
    expect(token?.value).toBe(SELECT);
    expect(token?.type).toBe(SQLTokenTypes.Keyword);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, { lineNumber: 1, column: 50 }],
    [sqlTestDataMultiLineFullQuery.query, { lineNumber: 5, column: 10 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 30 }],
    [sqlTestDataSingleLineTwoQueries.query, { lineNumber: 1, column: 185 }],
  ])('getSelectToken should return the right token', (query: string, position: monacoTypes.IPosition) => {
    const token = getToken(query, position, getSelectStatisticToken);
    expect(token).not.toBeNull();
    expect(token?.type).toBe(SQLTokenTypes.Function);
  });

  test.each([
    [sqlTestDataSingleLineFullQuery.query, 'AVG', { lineNumber: 1, column: 50 }],
    [sqlTestDataMultiLineFullQuery.query, 'AVG', { lineNumber: 5, column: 10 }],
    [sqlTestDataSingleLineTwoQueries.query, 'AVG', { lineNumber: 1, column: 30 }],
    [sqlTestDataSingleLineTwoQueries.query, 'SUM', { lineNumber: 1, column: 185 }],
  ])(
    'getSelectStatisticToken should return the right token',
    (query: string, value: string, position: monacoTypes.IPosition) => {
      const token = getToken(query, position, getSelectStatisticToken);
      expect(token).not.toBeNull();
      expect(token?.value).toBe(value);
      expect(token?.type).toBe(SQLTokenTypes.Function);
    }
  );

  test.each([
    [sqlTestDataSingleLineFullQuery.query, 'CPUUtilization', { lineNumber: 1, column: 50 }],
    [sqlTestDataMultiLineFullQuery.query, 'CPUUtilization', { lineNumber: 5, column: 10 }],
    [sqlTestDataSingleLineTwoQueries.query, 'CPUUtilization', { lineNumber: 1, column: 30 }],
    [sqlTestDataSingleLineTwoQueries.query, 'CPUCreditUsage', { lineNumber: 1, column: 185 }],
  ])(
    'getMetricNameToken should return the right token',
    (query: string, value: string, position: monacoTypes.IPosition) => {
      const token = getToken(query, position, getMetricNameToken);
      expect(token).not.toBeNull();
      expect(token?.value).toBe(value);
      expect(token?.type).toBe(SQLTokenTypes.Identifier);
    }
  );

  test.each([
    [sqlTestDataSingleLineFullQuery.query, '"AWS/EC2"', SQLTokenTypes.Type, { lineNumber: 1, column: 50 }],
    [sqlTestDataMultiLineFullQuery.query, '"AWS/ECS"', SQLTokenTypes.Type, { lineNumber: 5, column: 10 }],
    [sqlTestDataSingleLineTwoQueries.query, '"AWS/EC2"', SQLTokenTypes.Type, { lineNumber: 1, column: 30 }],
    [sqlTestDataSingleLineTwoQueries.query, '"AWS/ECS"', SQLTokenTypes.Type, { lineNumber: 1, column: 185 }],
    [sqlTestDataMultiLineIncompleteQueryWithoutNamespace.query, undefined, undefined, { lineNumber: 2, column: 5 }],
  ])(
    'getNamespaceToken should return the right token',
    (query: string, value: string | undefined, tokenType: string | undefined, position: monacoTypes.IPosition) => {
      const token = getToken(query, position, getNamespaceToken);
      expect(token?.value).toBe(value);
      expect(token?.type).toBe(tokenType);
    }
  );
});
