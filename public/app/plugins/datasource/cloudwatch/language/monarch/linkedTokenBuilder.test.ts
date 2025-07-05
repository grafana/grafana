import { monacoTypes } from '@grafana/ui';

import { sqlTestDataMultiLineFullQuery } from '../../mocks/cloudwatch-sql-test-data/multiLineFullQuery';
import { sqlTestDataSingleLineFullQuery } from '../../mocks/cloudwatch-sql-test-data/singleLineFullQuery';
import MonacoMock from '../../mocks/monarch/Monaco';
import TextModel from '../../mocks/monarch/TextModel';
import { SQLTokenTypes } from '../cloudwatch-sql/completion/types';
import cloudWatchSqlLanguageDefinition from '../cloudwatch-sql/definition';
import { DESC, SELECT } from '../cloudwatch-sql/language';

import { linkedTokenBuilder } from './linkedTokenBuilder';

describe('linkedTokenBuilder', () => {
  describe('singleLineFullQuery', () => {
    const testModel = TextModel(sqlTestDataSingleLineFullQuery.query);

    it('should add correct references to next LinkedToken', () => {
      const position: monacoTypes.IPosition = { lineNumber: 1, column: 0 };
      const current = linkedTokenBuilder(
        MonacoMock,
        cloudWatchSqlLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        SQLTokenTypes
      );

      expect(current?.is(SQLTokenTypes.Keyword, SELECT)).toBeTruthy();
      expect(current?.getNextNonWhiteSpaceToken()?.is(SQLTokenTypes.Function, 'AVG')).toBeTruthy();
    });

    it('should add correct references to previous LinkedToken', () => {
      const position: monacoTypes.IPosition = { lineNumber: 1, column: sqlTestDataSingleLineFullQuery.query.length };
      const current = linkedTokenBuilder(
        MonacoMock,
        cloudWatchSqlLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        SQLTokenTypes
      );
      expect(current?.is(SQLTokenTypes.Number, '10')).toBeTruthy();
      expect(current?.getPreviousNonWhiteSpaceToken()?.is(SQLTokenTypes.Keyword, 'LIMIT')).toBeTruthy();
      expect(
        current?.getPreviousNonWhiteSpaceToken()?.getPreviousNonWhiteSpaceToken()?.is(SQLTokenTypes.Keyword, DESC)
      ).toBeTruthy();
    });
  });

  describe('multiLineFullQuery', () => {
    const testModel = TextModel(sqlTestDataMultiLineFullQuery.query);

    it('should add LinkedToken with whitespace in case empty lines', () => {
      const position: monacoTypes.IPosition = { lineNumber: 3, column: 0 };
      const current = linkedTokenBuilder(
        MonacoMock,
        cloudWatchSqlLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        SQLTokenTypes
      );
      expect(current).not.toBeNull();
      expect(current?.isWhiteSpace()).toBeTruthy();
    });

    it('should add correct references to next LinkedToken', () => {
      const position: monacoTypes.IPosition = { lineNumber: 1, column: 0 };
      const current = linkedTokenBuilder(
        MonacoMock,
        cloudWatchSqlLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        SQLTokenTypes
      );
      expect(current?.is(SQLTokenTypes.Keyword, SELECT)).toBeTruthy();
      expect(current?.getNextNonWhiteSpaceToken()?.is(SQLTokenTypes.Function, 'AVG')).toBeTruthy();
    });

    it('should add correct references to previous LinkedToken even when references spans over multiple lines', () => {
      const position: monacoTypes.IPosition = { lineNumber: 6, column: 7 };
      const current = linkedTokenBuilder(
        MonacoMock,
        cloudWatchSqlLanguageDefinition,
        testModel as monacoTypes.editor.ITextModel,
        position,
        SQLTokenTypes
      );
      expect(current?.is(SQLTokenTypes.Number, '10')).toBeTruthy();
      expect(current?.getPreviousNonWhiteSpaceToken()?.is(SQLTokenTypes.Keyword, 'LIMIT')).toBeTruthy();
      expect(
        current?.getPreviousNonWhiteSpaceToken()?.getPreviousNonWhiteSpaceToken()?.is(SQLTokenTypes.Keyword, DESC)
      ).toBeTruthy();
    });
  });
});
