import { monacoTypes } from '@grafana/ui';

import { Monaco } from '../../monarch/types';
import * as SQLTestData from '../cloudwatch-sql-test-data';
import * as DynamicLabelTestData from '../dynamic-label-test-data';
import * as MetricMathTestData from '../metric-math-test-data';

// Stub for the Monaco instance.
const MonacoMock: Monaco = {
  editor: {
    tokenize: (value: string, languageId: string) => {
      if (languageId === 'cloudwatch-sql') {
        const TestData = {
          [SQLTestData.multiLineFullQuery.query]: SQLTestData.multiLineFullQuery.tokens,
          [SQLTestData.singleLineFullQuery.query]: SQLTestData.singleLineFullQuery.tokens,
          [SQLTestData.singleLineEmptyQuery.query]: SQLTestData.singleLineEmptyQuery.tokens,
          [SQLTestData.singleLineTwoQueries.query]: SQLTestData.singleLineTwoQueries.tokens,
          [SQLTestData.multiLineIncompleteQueryWithoutNamespace.query]:
            SQLTestData.multiLineIncompleteQueryWithoutNamespace.tokens,
        };
        return TestData[value];
      }
      if (languageId === 'cloudwatch-MetricMath') {
        const TestData = {
          [MetricMathTestData.singleLineEmptyQuery.query]: MetricMathTestData.singleLineEmptyQuery.tokens,
          [MetricMathTestData.afterFunctionQuery.query]: MetricMathTestData.afterFunctionQuery.tokens,
          [MetricMathTestData.secondArgQuery.query]: MetricMathTestData.secondArgQuery.tokens,
          [MetricMathTestData.secondArgAfterSearchQuery.query]: MetricMathTestData.secondArgAfterSearchQuery.tokens,
          [MetricMathTestData.withinStringQuery.query]: MetricMathTestData.withinStringQuery.tokens,
          [MetricMathTestData.thirdArgAfterSearchQuery.query]: MetricMathTestData.thirdArgAfterSearchQuery.tokens,
        };
        return TestData[value];
      }

      if (languageId === 'cloudwatch-dynamicLabels') {
        const TestData = {
          [DynamicLabelTestData.afterLabelValue.query]: DynamicLabelTestData.afterLabelValue.tokens,
          [DynamicLabelTestData.insideLabelValue.query]: DynamicLabelTestData.insideLabelValue.tokens,
        };
        return TestData[value];
      }
      return [];
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
    fromPositions: (start: monacoTypes.IPosition, end?: monacoTypes.IPosition) => {
      return {} as unknown as monacoTypes.Range;
    },
  },
  languages: {
    CompletionItemInsertTextRule: {
      InsertAsSnippet: 4,
    },
    CompletionItemKind: {
      Function: 1,
    },
  },
};

export default MonacoMock;
