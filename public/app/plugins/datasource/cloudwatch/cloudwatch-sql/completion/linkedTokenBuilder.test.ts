import { monacoTypes } from '@grafana/ui';
import MonacoMock from '../../__mocks__/cloudwatch-sql/Monaco';
import TextModel from '../../__mocks__/cloudwatch-sql/TextModel';
import { multiLineFullQuery, singleLineFullQuery } from '../../__mocks__/cloudwatch-sql/test-data';
import { linkedTokenBuilder } from './linkedTokenBuilder';
import { TokenType } from './types';
import { DESC, SELECT } from '../language';

describe('linkedTokenBuilder', () => {
  describe('singleLineFullQuery', () => {
    const testModel = TextModel(singleLineFullQuery.query);

    it('should add correct references to next LinkedToken', () => {
      const position: monacoTypes.IPosition = { lineNumber: 1, column: 0 };
      const current = linkedTokenBuilder(MonacoMock, testModel as monacoTypes.editor.ITextModel, position);
      expect(current?.is(TokenType.Keyword, SELECT)).toBeTruthy();
      expect(current?.getNextNonWhiteSpaceToken()?.is(TokenType.Function, 'AVG')).toBeTruthy();
    });

    it('should add correct references to previous LinkedToken', () => {
      const position: monacoTypes.IPosition = { lineNumber: 1, column: singleLineFullQuery.query.length };
      const current = linkedTokenBuilder(MonacoMock, testModel as monacoTypes.editor.ITextModel, position);
      expect(current?.is(TokenType.Number, '10')).toBeTruthy();
      expect(current?.getPreviousNonWhiteSpaceToken()?.is(TokenType.Keyword, 'LIMIT')).toBeTruthy();
      expect(
        current?.getPreviousNonWhiteSpaceToken()?.getPreviousNonWhiteSpaceToken()?.is(TokenType.Keyword, DESC)
      ).toBeTruthy();
    });
  });

  describe('multiLineFullQuery', () => {
    const testModel = TextModel(multiLineFullQuery.query);

    it('should add LinkedToken with whitespace in case empty lines', () => {
      const position: monacoTypes.IPosition = { lineNumber: 3, column: 0 };
      const current = linkedTokenBuilder(MonacoMock, testModel as monacoTypes.editor.ITextModel, position);
      expect(current).not.toBeNull();
      expect(current?.isWhiteSpace()).toBeTruthy();
    });

    it('should add correct references to next LinkedToken', () => {
      const position: monacoTypes.IPosition = { lineNumber: 1, column: 0 };
      const current = linkedTokenBuilder(MonacoMock, testModel as monacoTypes.editor.ITextModel, position);
      expect(current?.is(TokenType.Keyword, SELECT)).toBeTruthy();
      expect(current?.getNextNonWhiteSpaceToken()?.is(TokenType.Function, 'AVG')).toBeTruthy();
    });

    it('should add correct references to previous LinkedToken even when references spans over multiple lines', () => {
      const position: monacoTypes.IPosition = { lineNumber: 6, column: 7 };
      const current = linkedTokenBuilder(MonacoMock, testModel as monacoTypes.editor.ITextModel, position);
      expect(current?.is(TokenType.Number, '10')).toBeTruthy();
      expect(current?.getPreviousNonWhiteSpaceToken()?.is(TokenType.Keyword, 'LIMIT')).toBeTruthy();
      expect(
        current?.getPreviousNonWhiteSpaceToken()?.getPreviousNonWhiteSpaceToken()?.is(TokenType.Keyword, DESC)
      ).toBeTruthy();
    });
  });
});
