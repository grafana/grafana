import { multiLineFullQuery, singleLineFullQuery } from '../../__mocks__/cloudwatch-sql-test-data';
import MonacoMock from '../../__mocks__/monarch/Monaco';
import TextModel from '../../__mocks__/monarch/TextModel';
import { SQLTokenTypes } from '../cloudwatch-sql/completion/types';
import cloudWatchSqlLanguageDefinition from '../cloudwatch-sql/definition';
import { DESC, SELECT } from '../cloudwatch-sql/language';
import { linkedTokenBuilder } from './linkedTokenBuilder';
describe('linkedTokenBuilder', () => {
    describe('singleLineFullQuery', () => {
        const testModel = TextModel(singleLineFullQuery.query);
        it('should add correct references to next LinkedToken', () => {
            var _a;
            const position = { lineNumber: 1, column: 0 };
            const current = linkedTokenBuilder(MonacoMock, cloudWatchSqlLanguageDefinition, testModel, position, SQLTokenTypes);
            expect(current === null || current === void 0 ? void 0 : current.is(SQLTokenTypes.Keyword, SELECT)).toBeTruthy();
            expect((_a = current === null || current === void 0 ? void 0 : current.getNextNonWhiteSpaceToken()) === null || _a === void 0 ? void 0 : _a.is(SQLTokenTypes.Function, 'AVG')).toBeTruthy();
        });
        it('should add correct references to previous LinkedToken', () => {
            var _a, _b, _c;
            const position = { lineNumber: 1, column: singleLineFullQuery.query.length };
            const current = linkedTokenBuilder(MonacoMock, cloudWatchSqlLanguageDefinition, testModel, position, SQLTokenTypes);
            expect(current === null || current === void 0 ? void 0 : current.is(SQLTokenTypes.Number, '10')).toBeTruthy();
            expect((_a = current === null || current === void 0 ? void 0 : current.getPreviousNonWhiteSpaceToken()) === null || _a === void 0 ? void 0 : _a.is(SQLTokenTypes.Keyword, 'LIMIT')).toBeTruthy();
            expect((_c = (_b = current === null || current === void 0 ? void 0 : current.getPreviousNonWhiteSpaceToken()) === null || _b === void 0 ? void 0 : _b.getPreviousNonWhiteSpaceToken()) === null || _c === void 0 ? void 0 : _c.is(SQLTokenTypes.Keyword, DESC)).toBeTruthy();
        });
    });
    describe('multiLineFullQuery', () => {
        const testModel = TextModel(multiLineFullQuery.query);
        it('should add LinkedToken with whitespace in case empty lines', () => {
            const position = { lineNumber: 3, column: 0 };
            const current = linkedTokenBuilder(MonacoMock, cloudWatchSqlLanguageDefinition, testModel, position, SQLTokenTypes);
            expect(current).not.toBeNull();
            expect(current === null || current === void 0 ? void 0 : current.isWhiteSpace()).toBeTruthy();
        });
        it('should add correct references to next LinkedToken', () => {
            var _a;
            const position = { lineNumber: 1, column: 0 };
            const current = linkedTokenBuilder(MonacoMock, cloudWatchSqlLanguageDefinition, testModel, position, SQLTokenTypes);
            expect(current === null || current === void 0 ? void 0 : current.is(SQLTokenTypes.Keyword, SELECT)).toBeTruthy();
            expect((_a = current === null || current === void 0 ? void 0 : current.getNextNonWhiteSpaceToken()) === null || _a === void 0 ? void 0 : _a.is(SQLTokenTypes.Function, 'AVG')).toBeTruthy();
        });
        it('should add correct references to previous LinkedToken even when references spans over multiple lines', () => {
            var _a, _b, _c;
            const position = { lineNumber: 6, column: 7 };
            const current = linkedTokenBuilder(MonacoMock, cloudWatchSqlLanguageDefinition, testModel, position, SQLTokenTypes);
            expect(current === null || current === void 0 ? void 0 : current.is(SQLTokenTypes.Number, '10')).toBeTruthy();
            expect((_a = current === null || current === void 0 ? void 0 : current.getPreviousNonWhiteSpaceToken()) === null || _a === void 0 ? void 0 : _a.is(SQLTokenTypes.Keyword, 'LIMIT')).toBeTruthy();
            expect((_c = (_b = current === null || current === void 0 ? void 0 : current.getPreviousNonWhiteSpaceToken()) === null || _b === void 0 ? void 0 : _b.getPreviousNonWhiteSpaceToken()) === null || _c === void 0 ? void 0 : _c.is(SQLTokenTypes.Keyword, DESC)).toBeTruthy();
        });
    });
});
//# sourceMappingURL=linkedTokenBuilder.test.js.map