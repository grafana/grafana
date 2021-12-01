import { monacoTypes } from '@grafana/ui';
import { LinkedToken } from './LinkedToken';
import MonacoMock from '../../__mocks__/cloudwatch-sql/Monaco';
import TextModel from '../../__mocks__/cloudwatch-sql/TextModel';
import {
  multiLineFullQuery,
  singleLineFullQuery,
  singleLineTwoQueries,
  multiLineIncompleteQueryWithoutNamespace,
} from '../../__mocks__/cloudwatch-sql/test-data';
import { linkedTokenBuilder } from './linkedTokenBuilder';
import { TokenType } from './types';
import { getMetricNameToken, getNamespaceToken, getSelectStatisticToken, getSelectToken } from './tokenUtils';
import { SELECT } from '../language';

const getToken = (
  query: string,
  position: monacoTypes.IPosition,
  invokeFunction: (token: LinkedToken | null) => LinkedToken | null
) => {
  const testModel = TextModel(query);
  const current = linkedTokenBuilder(MonacoMock, testModel as monacoTypes.editor.ITextModel, position);
  return invokeFunction(current);
};

describe('tokenUtils', () => {
  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 50 }],
    [multiLineFullQuery.query, { lineNumber: 5, column: 10 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 30 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 185 }],
  ])('getSelectToken should return the right token', (query: string, position: monacoTypes.IPosition) => {
    const token = getToken(query, position, getSelectToken);
    expect(token).not.toBeNull();
    expect(token?.value).toBe(SELECT);
    expect(token?.type).toBe(TokenType.Keyword);
  });

  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 50 }],
    [multiLineFullQuery.query, { lineNumber: 5, column: 10 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 30 }],
    [singleLineTwoQueries.query, { lineNumber: 1, column: 185 }],
  ])('getSelectToken should return the right token', (query: string, position: monacoTypes.IPosition) => {
    const token = getToken(query, position, getSelectStatisticToken);
    expect(token).not.toBeNull();
    expect(token?.type).toBe(TokenType.Function);
  });

  test.each([
    [singleLineFullQuery.query, 'AVG', { lineNumber: 1, column: 50 }],
    [multiLineFullQuery.query, 'AVG', { lineNumber: 5, column: 10 }],
    [singleLineTwoQueries.query, 'AVG', { lineNumber: 1, column: 30 }],
    [singleLineTwoQueries.query, 'SUM', { lineNumber: 1, column: 185 }],
  ])(
    'getSelectStatisticToken should return the right token',
    (query: string, value: string, position: monacoTypes.IPosition) => {
      const token = getToken(query, position, getSelectStatisticToken);
      expect(token).not.toBeNull();
      expect(token?.value).toBe(value);
      expect(token?.type).toBe(TokenType.Function);
    }
  );

  test.each([
    [singleLineFullQuery.query, 'CPUUtilization', { lineNumber: 1, column: 50 }],
    [multiLineFullQuery.query, 'CPUUtilization', { lineNumber: 5, column: 10 }],
    [singleLineTwoQueries.query, 'CPUUtilization', { lineNumber: 1, column: 30 }],
    [singleLineTwoQueries.query, 'CPUCreditUsage', { lineNumber: 1, column: 185 }],
  ])(
    'getMetricNameToken should return the right token',
    (query: string, value: string, position: monacoTypes.IPosition) => {
      const token = getToken(query, position, getMetricNameToken);
      expect(token).not.toBeNull();
      expect(token?.value).toBe(value);
      expect(token?.type).toBe(TokenType.Identifier);
    }
  );

  test.each([
    [singleLineFullQuery.query, '"AWS/EC2"', TokenType.Type, { lineNumber: 1, column: 50 }],
    [multiLineFullQuery.query, '"AWS/ECS"', TokenType.Type, { lineNumber: 5, column: 10 }],
    [singleLineTwoQueries.query, '"AWS/EC2"', TokenType.Type, { lineNumber: 1, column: 30 }],
    [singleLineTwoQueries.query, '"AWS/ECS"', TokenType.Type, { lineNumber: 1, column: 185 }],
    [multiLineIncompleteQueryWithoutNamespace.query, undefined, undefined, { lineNumber: 2, column: 5 }],
  ])(
    'getNamespaceToken should return the right token',
    (query: string, value: string | undefined, tokenType: TokenType | undefined, position: monacoTypes.IPosition) => {
      const token = getToken(query, position, getNamespaceToken);
      expect(token?.value).toBe(value);
      expect(token?.type).toBe(tokenType);
    }
  );
});
