import { monacoTypes } from '@grafana/ui';
import { Monaco } from '../../cloudwatch-sql/completion/types';
import {
  multiLineFullQuery,
  singleLineFullQuery,
  singleLineEmptyQuery,
  singleLineTwoQueries,
  multiLineIncompleteQueryWithoutNamespace,
} from './test-data';

const TestData = {
  [multiLineFullQuery.query]: multiLineFullQuery.tokens,
  [singleLineFullQuery.query]: singleLineFullQuery.tokens,
  [singleLineEmptyQuery.query]: singleLineEmptyQuery.tokens,
  [singleLineTwoQueries.query]: singleLineTwoQueries.tokens,
  [multiLineIncompleteQueryWithoutNamespace.query]: multiLineIncompleteQueryWithoutNamespace.tokens,
};

// Stub for the Monaco instance. Only implements the parts that are used in cloudwatch sql
const MonacoMock: Monaco = {
  editor: {
    tokenize: (value: string, languageId: string) => {
      return TestData[value];
    },
  },
  Range: {
    containsPosition: (range: monacoTypes.IRange, position: monacoTypes.IPosition) => {
      return (
        position.lineNumber >= range.startLineNumber &&
        position.lineNumber <= range.endLineNumber &&
        position.column >= range.startColumn &&
        position.column <= range.endColumn
      );
    },
  },
};

export default MonacoMock;
