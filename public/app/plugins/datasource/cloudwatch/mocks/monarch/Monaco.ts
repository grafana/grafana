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
import { logsTestDataCommentOnlyQuery } from '../cloudwatch-logs-test-data/commentOnlyQuery';
import { logsTestDataEmptyQuery } from '../cloudwatch-logs-test-data/empty';
import { logsTestDataFilterQuery } from '../cloudwatch-logs-test-data/filterQuery';
import { logsTestDataMultiLineFullQuery } from '../cloudwatch-logs-test-data/multiLineFullQuery';
import { logsTestDataNewCommandQuery } from '../cloudwatch-logs-test-data/newCommandQuery';
import { logsTestDataSingleLineFullQuery } from '../cloudwatch-logs-test-data/singleLineFullQuery';
import { logsTestDataSortQuery } from '../cloudwatch-logs-test-data/sortQuery';
import { logsTestDataWhitespaceOnlyQuery } from '../cloudwatch-logs-test-data/whitespaceQuery';
import * as PPLMultilineQueries from '../cloudwatch-ppl-test-data/multilineQueries';
import { newCommandQuery as PPLNewCommandQuery } from '../cloudwatch-ppl-test-data/newCommandQuery';
import * as PPLSingleLineQueries from '../cloudwatch-ppl-test-data/singleLineQueries';
import { sqlTestDataMultiLineFullQuery } from '../cloudwatch-sql-test-data/multiLineFullQuery';
import { sqlTestDataMultiLineIncompleteQueryWithoutNamespace } from '../cloudwatch-sql-test-data/multiLineIncompleteQueryWithoutNamespace';
import { sqlTestDataSingleLineEmptyQuery } from '../cloudwatch-sql-test-data/singleLineEmptyQuery';
import { sqlTestDataSingleLineFullQuery } from '../cloudwatch-sql-test-data/singleLineFullQuery';
import { sqlTestDataSingleLineTwoQueries } from '../cloudwatch-sql-test-data/singleLineTwoQueries';
import { dynamicLabelTestDataAfterLabelValue } from '../dynamic-label-test-data/afterLabelValue';
import { dynamicLabelTestDataInsideLabelValue } from '../dynamic-label-test-data/insideLabelValue';
import { afterFunctionQuery } from '../metric-math-test-data/afterFunctionQuery';
import { secondArgAfterSearchQuery } from '../metric-math-test-data/secondArgAfterSearchQuery';
import { secondArgQuery } from '../metric-math-test-data/secondArgQuery';
import { singleLineEmptyQuery } from '../metric-math-test-data/singleLineEmptyQuery';
import { thirdArgAfterSearchQuery } from '../metric-math-test-data/thirdArgAfterSearchQuery';
import { withinStringQuery } from '../metric-math-test-data/withinStringQuery';

// Stub for the Monaco instance.
const MonacoMock: Monaco = {
  editor: {
    tokenize: (value: string, languageId: string) => {
      if (languageId === 'cloudwatch-sql') {
        const TestData = {
          [sqlTestDataMultiLineFullQuery.query]: sqlTestDataMultiLineFullQuery.tokens,
          [sqlTestDataSingleLineFullQuery.query]: sqlTestDataSingleLineFullQuery.tokens,
          [sqlTestDataSingleLineEmptyQuery.query]: sqlTestDataSingleLineEmptyQuery.tokens,
          [sqlTestDataSingleLineTwoQueries.query]: sqlTestDataSingleLineTwoQueries.tokens,
          [sqlTestDataMultiLineIncompleteQueryWithoutNamespace.query]:
            sqlTestDataMultiLineIncompleteQueryWithoutNamespace.tokens,
        };
        return TestData[value];
      }
      if (languageId === 'cloudwatch-MetricMath') {
        const TestData = {
          [singleLineEmptyQuery.query]: singleLineEmptyQuery.tokens,
          [afterFunctionQuery.query]: afterFunctionQuery.tokens,
          [secondArgQuery.query]: secondArgQuery.tokens,
          [secondArgAfterSearchQuery.query]: secondArgAfterSearchQuery.tokens,
          [withinStringQuery.query]: withinStringQuery.tokens,
          [thirdArgAfterSearchQuery.query]: thirdArgAfterSearchQuery.tokens,
        };
        return TestData[value];
      }

      if (languageId === 'cloudwatch-dynamicLabels') {
        const TestData = {
          [dynamicLabelTestDataAfterLabelValue.query]: dynamicLabelTestDataAfterLabelValue.tokens,
          [dynamicLabelTestDataInsideLabelValue.query]: dynamicLabelTestDataInsideLabelValue.tokens,
        };
        return TestData[value];
      }
      if (languageId === CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID) {
        const TestData = {
          [logsTestDataEmptyQuery.query]: logsTestDataEmptyQuery.tokens,
          [logsTestDataWhitespaceOnlyQuery.query]: logsTestDataWhitespaceOnlyQuery.tokens,
          [logsTestDataCommentOnlyQuery.query]: logsTestDataCommentOnlyQuery.tokens,
          [logsTestDataSingleLineFullQuery.query]: logsTestDataSingleLineFullQuery.tokens,
          [logsTestDataMultiLineFullQuery.query]: logsTestDataMultiLineFullQuery.tokens,
          [logsTestDataFilterQuery.query]: logsTestDataFilterQuery.tokens,
          [logsTestDataNewCommandQuery.query]: logsTestDataNewCommandQuery.tokens,
          [logsTestDataSortQuery.query]: logsTestDataSortQuery.tokens,
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
