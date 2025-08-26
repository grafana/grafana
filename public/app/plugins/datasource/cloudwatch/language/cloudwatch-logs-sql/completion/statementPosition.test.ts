import { monacoTypes } from '@grafana/ui';

import { commentOnlyQuery } from '../../../mocks/cloudwatch-logs-sql-test-data/commentOnlyQuery';
import { multiLineFullQuery } from '../../../mocks/cloudwatch-logs-sql-test-data/multiLineFullQuery';
import { multiLineFullQueryWithCaseClause } from '../../../mocks/cloudwatch-logs-sql-test-data/multiLineFullQueryWithCaseClause';
import { partialQueryWithFunction } from '../../../mocks/cloudwatch-logs-sql-test-data/partialQueryWithFunction';
import { partialQueryWithSubquery } from '../../../mocks/cloudwatch-logs-sql-test-data/partialQueryWithSubquery';
import { singleLineFullQuery } from '../../../mocks/cloudwatch-logs-sql-test-data/singleLineFullQuery';
import { whitespaceQuery } from '../../../mocks/cloudwatch-logs-sql-test-data/whitespaceQuery';
import MonacoMock from '../../../mocks/monarch/Monaco';
import TextModel from '../../../mocks/monarch/TextModel';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import { StatementPosition } from '../../monarch/types';
import cloudWatchLogsSqlLanguageDefinition from '../definition';

import { getStatementPosition } from './statementPosition';
import { SQLTokenTypes } from './types';

describe('statementPosition', () => {
  function assertPosition(query: string, position: monacoTypes.IPosition, expected: StatementPosition) {
    const testModel = TextModel(query);
    const current = linkedTokenBuilder(
      MonacoMock,
      cloudWatchLogsSqlLanguageDefinition,
      testModel as monacoTypes.editor.ITextModel,
      position,
      SQLTokenTypes
    );
    const statementPosition = getStatementPosition(current);
    expect(StatementPosition[statementPosition]).toBe(StatementPosition[expected]);
  }

  test.each([
    [commentOnlyQuery.query, { lineNumber: 1, column: 0 }],
    [singleLineFullQuery.query, { lineNumber: 1, column: 202 }],
    [multiLineFullQuery.query, { lineNumber: 10, column: 0 }],
    [multiLineFullQuery.query, { lineNumber: 11, column: 0 }],
    [multiLineFullQuery.query, { lineNumber: 12, column: 0 }],
    [multiLineFullQuery.query, { lineNumber: 13, column: 0 }],
    [multiLineFullQuery.query, { lineNumber: 14, column: 0 }],
    [multiLineFullQuery.query, { lineNumber: 15, column: 0 }],
    [multiLineFullQuery.query, { lineNumber: 16, column: 0 }],
  ])('should be comment', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.Comment);
  });
  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 0 }],
    [multiLineFullQuery.query, { lineNumber: 1, column: 0 }],
    [whitespaceQuery.query, { lineNumber: 1, column: 0 }],
  ])('should be select keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.SelectKeyword);
  });
  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 7 }],
    [multiLineFullQuery.query, { lineNumber: 1, column: 7 }],
  ])('should be after select keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterSelectKeyword);
  });
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 37 }]])(
    'should be select expression',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.SelectExpression);
    }
  );
  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 103 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 6, column: 4 }],
  ])('should be after select expression', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterSelectExpression);
  });
  test.each([[partialQueryWithSubquery.query, { lineNumber: 1, column: 52 }]])(
    'should be subquery',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.Subquery);
    }
  );
  test.each([[partialQueryWithFunction.query, { lineNumber: 1, column: 14 }]])(
    'should be predefined function argument',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.PredefinedFunctionArgument);
    }
  );
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 108 }]])(
    'should be after from keyword',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterFromKeyword);
    }
  );
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 125 }]])(
    'should be after from arguments',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterFromArguments);
    }
  );
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 182 }]])(
    'should be where key',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.WhereKey);
    }
  );
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 191 }]])(
    'should be where comparison operator',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.WhereComparisonOperator);
    }
  );
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 193 }]])(
    'should be where value',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.WhereValue);
    }
  );
  test.each([
    [singleLineFullQuery.query, { lineNumber: 1, column: 201 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 13, column: 4 }],
  ])('should be after where value', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterWhereValue);
  });
  test.each([[multiLineFullQuery.query, { lineNumber: 8, column: 7 }]])(
    'should be having key',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.HavingKey);
    }
  );
  test.each([[multiLineFullQuery.query, { lineNumber: 8, column: 13 }]])(
    'should be having comparison operator',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.HavingComparisonOperator);
    }
  );
  test.each([[multiLineFullQuery.query, { lineNumber: 8, column: 15 }]])(
    'should be having value',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.HavingValue);
    }
  );
  test.each([[multiLineFullQuery.query, { lineNumber: 8, column: 18 }]])(
    'should be after having value',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterHavingValue);
    }
  );
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 156 }]])(
    'should be on key',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.OnKey);
    }
  );
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 165 }]])(
    'should be on comparison operator',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.OnComparisonOperator);
    }
  );
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 167 }]])(
    'should be on value',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.OnValue);
    }
  );
  test.each([[singleLineFullQuery.query, { lineNumber: 1, column: 176 }]])(
    'should be after on value',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterOnValue);
    }
  );
  test.each([
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 2, column: 5 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 9, column: 5 }],
  ])('should be case key', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.CaseKey);
  });
  test.each([
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 2, column: 8 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 9, column: 7 }],
  ])('should be case comparison operator', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.CaseComparisonOperator);
  });
  test.each([[multiLineFullQueryWithCaseClause.query, { lineNumber: 9, column: 9 }]])(
    'should be case value',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.CaseValue);
    }
  );
  test.each([[multiLineFullQueryWithCaseClause.query, { lineNumber: 9, column: 11 }]])(
    'should be after case value',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterCaseValue);
    }
  );
  test.each([
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 3, column: 5 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 5 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 10, column: 5 }],
  ])('should be when key', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.WhenKey);
  });
  test.each([
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 3, column: 9 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 8 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 10, column: 9 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 11, column: 9 }],
  ])('should be when comparison operator', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.WhenComparisonOperator);
  });
  test.each([[multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 10 }]])(
    'should be when value',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.WhenValue);
    }
  );
  test.each([[multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 14 }]])(
    'should be after when value',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterWhenValue);
    }
  );
  test.each([
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 3, column: 14 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 19 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 10, column: 14 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 11, column: 14 }],
  ])('should be then expression', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.ThenExpression);
  });
  test.each([
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 3, column: 20 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 4, column: 29 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 10, column: 21 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 11, column: 24 }],
  ])('should be after then expression', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterThenExpression);
  });
  test.each([
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 5, column: 5 }],
    [multiLineFullQueryWithCaseClause.query, { lineNumber: 12, column: 5 }],
  ])('should be after else keyword', (query: string, position: monacoTypes.IPosition) => {
    assertPosition(query, position, StatementPosition.AfterElseKeyword);
  });
  test.each([[multiLineFullQuery.query, { lineNumber: 7, column: 9 }]])(
    'should be after group by keywords',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterGroupByKeywords);
    }
  );
  test.each([[multiLineFullQuery.query, { lineNumber: 7, column: 27 }]])(
    'should be after group by',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterGroupBy);
    }
  );
  test.each([[multiLineFullQuery.query, { lineNumber: 9, column: 9 }]])(
    'should be after order by keywords',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterOrderByKeywords);
    }
  );
  test.each([[multiLineFullQuery.query, { lineNumber: 9, column: 26 }]])(
    'should be after order by direction',
    (query: string, position: monacoTypes.IPosition) => {
      assertPosition(query, position, StatementPosition.AfterOrderByDirection);
    }
  );
});
