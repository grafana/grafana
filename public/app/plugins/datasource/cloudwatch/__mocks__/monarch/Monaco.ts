import { monacoTypes } from '@grafana/ui';

import { CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID } from '../../language/cloudwatch-logs-sql/definition';
import { CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID } from '../../language/cloudwatch-ppl/language';
import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';
import { Monaco } from '../../language/monarch/types';
import { commentOnlyQuery as cloudwatchLogsSQLCommentOnlyQuery } from '../cloudwatch-logs-sql-test-data/commentOnlyQuery';
import { multiLineFullQuery as cloudwatchLogsSQLMultiLineFullQuery } from '../cloudwatch-logs-sql-test-data/multiLineFullQuery';
import { multiLineFullQueryWithCaseClause as cloudwatchLogsSQLMultiLineFullQueryWithCaseClause } from '../cloudwatch-logs-sql-test-data/multiLineFullQueryWithCaseClause';
import { partialQueryWithFunction as cloudwatchLogsSQLPartialQueryWithFunction } from '../cloudwatch-logs-sql-test-data/partialQueryWithFunction';
import { partialQueryWithSubquery as cloudwatchLogsSQLPartialQueryWithSubquery } from '../cloudwatch-logs-sql-test-data/partialQueryWithSubquery';
import { singleLineFullQuery as cloudwatchLogsSQLSingleLineFullQuery } from '../cloudwatch-logs-sql-test-data/singleLineFullQuery';
import { whitespaceQuery as cloudwatchLogsSQLWhitespaceQuery } from '../cloudwatch-logs-sql-test-data/whitespaceQuery';
import * as CloudwatchLogsTestData from '../cloudwatch-logs-test-data';
import * as PPLMultilineQueries from '../cloudwatch-ppl-test-data/multilineQueries';
import { newCommandQuery as PPLNewCommandQuery } from '../cloudwatch-ppl-test-data/newCommandQuery';
import * as PPLSingleLineQueries from '../cloudwatch-ppl-test-data/singleLineQueries';
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
      if (languageId === CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID) {
        const TestData = {
          [CloudwatchLogsTestData.emptyQuery.query]: CloudwatchLogsTestData.emptyQuery.tokens,
          [CloudwatchLogsTestData.whitespaceOnlyQuery.query]: CloudwatchLogsTestData.whitespaceOnlyQuery.tokens,
          [CloudwatchLogsTestData.commentOnlyQuery.query]: CloudwatchLogsTestData.commentOnlyQuery.tokens,
          [CloudwatchLogsTestData.singleLineFullQuery.query]: CloudwatchLogsTestData.singleLineFullQuery.tokens,
          [CloudwatchLogsTestData.multiLineFullQuery.query]: CloudwatchLogsTestData.multiLineFullQuery.tokens,
          [CloudwatchLogsTestData.filterQuery.query]: CloudwatchLogsTestData.filterQuery.tokens,
          [CloudwatchLogsTestData.newCommandQuery.query]: CloudwatchLogsTestData.newCommandQuery.tokens,
          [CloudwatchLogsTestData.sortQuery.query]: CloudwatchLogsTestData.sortQuery.tokens,
        };
        return TestData[value];
      }
      if (languageId === CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID) {
        const TestData = {
          [PPLSingleLineQueries.emptyQuery.query]: PPLSingleLineQueries.emptyQuery.tokens,
          [PPLSingleLineQueries.whitespaceOnlyQuery.query]: PPLSingleLineQueries.whitespaceOnlyQuery.tokens,
          [PPLNewCommandQuery.query]: PPLNewCommandQuery.tokens,
          [PPLMultilineQueries.multiLineFullQuery.query]: PPLMultilineQueries.multiLineFullQuery.tokens,
          [PPLMultilineQueries.multiLineNewCommandQuery.query]: PPLMultilineQueries.multiLineNewCommandQuery.tokens,
          [PPLSingleLineQueries.whereQuery.query]: PPLSingleLineQueries.whereQuery.tokens,
          [PPLSingleLineQueries.fieldsQuery.query]: PPLSingleLineQueries.fieldsQuery.tokens,
          [PPLSingleLineQueries.statsQuery.query]: PPLSingleLineQueries.statsQuery.tokens,
          [PPLSingleLineQueries.eventStatsQuery.query]: PPLSingleLineQueries.eventStatsQuery.tokens,
          [PPLSingleLineQueries.dedupQueryWithOptionalArgs.query]:
            PPLSingleLineQueries.dedupQueryWithOptionalArgs.tokens,
          [PPLSingleLineQueries.dedupQueryWithoutOptionalArgs.query]:
            PPLSingleLineQueries.dedupQueryWithoutOptionalArgs.tokens,
          [PPLSingleLineQueries.sortQuery.query]: PPLSingleLineQueries.sortQuery.tokens,
          [PPLSingleLineQueries.sortQueryWithFunctions.query]: PPLSingleLineQueries.sortQueryWithFunctions.tokens,
          [PPLSingleLineQueries.headQuery.query]: PPLSingleLineQueries.headQuery.tokens,
          [PPLSingleLineQueries.topQuery.query]: PPLSingleLineQueries.topQuery.tokens,
          [PPLSingleLineQueries.rareQuery.query]: PPLSingleLineQueries.rareQuery.tokens,
          [PPLSingleLineQueries.evalQuery.query]: PPLSingleLineQueries.evalQuery.tokens,
          [PPLSingleLineQueries.parseQuery.query]: PPLSingleLineQueries.parseQuery.tokens,
          [PPLSingleLineQueries.queryWithArithmeticOps.query]: PPLSingleLineQueries.queryWithArithmeticOps.tokens,
          [PPLSingleLineQueries.queryWithLogicalExpression.query]:
            PPLSingleLineQueries.queryWithLogicalExpression.tokens,
          [PPLSingleLineQueries.queryWithFieldList.query]: PPLSingleLineQueries.queryWithFieldList.tokens,
          [PPLSingleLineQueries.queryWithFunctionCalls.query]: PPLSingleLineQueries.queryWithFunctionCalls.tokens,
        };
        return TestData[value];
      }
      if (languageId === CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID) {
        const TestData = {
          [cloudwatchLogsSQLCommentOnlyQuery.query]: cloudwatchLogsSQLCommentOnlyQuery.tokens,
          [cloudwatchLogsSQLMultiLineFullQuery.query]: cloudwatchLogsSQLMultiLineFullQuery.tokens,
          [cloudwatchLogsSQLMultiLineFullQueryWithCaseClause.query]:
            cloudwatchLogsSQLMultiLineFullQueryWithCaseClause.tokens,
          [cloudwatchLogsSQLPartialQueryWithFunction.query]: cloudwatchLogsSQLPartialQueryWithFunction.tokens,
          [cloudwatchLogsSQLPartialQueryWithSubquery.query]: cloudwatchLogsSQLPartialQueryWithSubquery.tokens,
          [cloudwatchLogsSQLSingleLineFullQuery.query]: cloudwatchLogsSQLSingleLineFullQuery.tokens,
          [cloudwatchLogsSQLWhitespaceQuery.query]: cloudwatchLogsSQLWhitespaceQuery.tokens,
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
