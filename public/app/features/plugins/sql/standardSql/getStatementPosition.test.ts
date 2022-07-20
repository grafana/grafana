import {
  multiLineFullQuery,
  multiLineFullQueryWithAggregation,
  multiLineMultipleColumns,
  singleLineEmptyQuery,
  singleLineFullQuery,
  singleLineFullQueryWithAggregation,
  singleLineMultipleColumns,
  singleLineTwoQueries,
  singleLineTwoQueriesWithAggregation,
} from '../mocks/testData';
import { testStatementPosition } from '../test-utils/statementPosition';
import { StatementPosition } from '../types';

import { initStatementPositionResolvers } from './statementPositionResolversRegistry';

const templateSrvMock = { replace: jest.fn(), getVariables: () => [], getAdhocFilters: jest.fn() };
jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getTemplateSrv: () => templateSrvMock,
}));

describe('statementPosition', () => {
  testStatementPosition(
    StatementPosition.SelectKeyword,
    [
      { query: singleLineEmptyQuery, position: { line: 1, column: 0 } },
      { query: singleLineFullQuery, position: { line: 1, column: 0 } },
      { query: multiLineFullQuery, position: { line: 1, column: 0 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 103 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterSelectKeyword,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 7 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 109 } },
      { query: multiLineFullQuery, position: { line: 1, column: 7 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterSelectArguments,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 16 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 16 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 118 } },
      { query: multiLineFullQuery, position: { line: 1, column: 16 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterSelectFuncFirstArgument,
    [
      { query: singleLineFullQueryWithAggregation, position: { line: 1, column: 14 } },
      { query: multiLineFullQueryWithAggregation, position: { line: 1, column: 14 } },
      { query: singleLineTwoQueriesWithAggregation, position: { line: 1, column: 128 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.FromKeyword,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 17 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 119 } },
      { query: multiLineFullQuery, position: { line: 2, column: 0 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterFromKeyword,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 21 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 123 } },
      { query: multiLineFullQuery, position: { line: 2, column: 5 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterFrom,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 28 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 130 } },
      { query: multiLineFullQuery, position: { line: 2, column: 12 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.WhereKeyword,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 34 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 136 } },
      { query: multiLineFullQuery, position: { line: 4, column: 6 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.WhereComparisonOperator,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 43 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 145 } },
      { query: multiLineFullQuery, position: { line: 4, column: 15 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.WhereValue,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 44 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 146 } },
      { query: multiLineFullQuery, position: { line: 4, column: 16 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterWhereValue,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 53 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 155 } },
      { query: multiLineFullQuery, position: { line: 4, column: 25 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterGroupByKeywords,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 63 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 167 } },
      { query: multiLineFullQuery, position: { line: 5, column: 11 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterGroupBy,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 71 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 173 } },
      { query: multiLineFullQuery, position: { line: 5, column: 18 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterOrderByKeywords,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 80 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 181 } },
      { query: multiLineFullQuery, position: { line: 5, column: 26 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterOrderByFunction,
    [
      { query: singleLineMultipleColumns, position: { line: 1, column: 108 } },
      { query: multiLineMultipleColumns, position: { line: 5, column: 40 } },
    ],
    initStatementPositionResolvers
  );

  testStatementPosition(
    StatementPosition.AfterOrderByDirection,
    [
      { query: singleLineFullQuery, position: { line: 1, column: 92 } },
      { query: singleLineTwoQueries, position: { line: 1, column: 196 } },
      { query: multiLineFullQuery, position: { line: 5, column: 39 } },
    ],
    initStatementPositionResolvers
  );
});
