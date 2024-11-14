import { monacoTypes } from '@grafana/ui';

import * as MetricMathTestQueries from '../../../__mocks__/metric-math-test-data';
import MonacoMock from '../../../__mocks__/monarch/Monaco';
import TextModel from '../../../__mocks__/monarch/TextModel';
import { linkedTokenBuilder } from '../../monarch/linkedTokenBuilder';
import { StatementPosition } from '../../monarch/types';
import cloudWatchSqlLanguageDefinition from '../definition';

import { getStatementPosition } from './statementPosition';
import { MetricMathTokenTypes } from './types';

describe('statementPosition', () => {
  function createToken(query: string, position: monacoTypes.IPosition) {
    const testModel = TextModel(query);
    return linkedTokenBuilder(
      MonacoMock,
      cloudWatchSqlLanguageDefinition,
      testModel as monacoTypes.editor.ITextModel,
      position,
      MetricMathTokenTypes
    );
  }

  it('returns PredefinedFunction when at the beginning of an empty query', () => {
    const token = createToken(
      MetricMathTestQueries.singleLineEmptyQuery.query,
      MetricMathTestQueries.singleLineEmptyQuery.position
    );
    expect(getStatementPosition(token)).toEqual(StatementPosition.PredefinedFunction);
  });

  it('returns PredefinedFuncSecondArg when in the second arg of a predefined function', () => {
    const token = createToken(
      MetricMathTestQueries.secondArgQuery.query,
      MetricMathTestQueries.secondArgQuery.position
    );
    expect(getStatementPosition(token)).toEqual(StatementPosition.PredefinedFuncSecondArg);
  });

  it('returns SearchFuncSecondArg when in the second arg of a Search function', () => {
    const token = createToken(
      MetricMathTestQueries.secondArgAfterSearchQuery.query,
      MetricMathTestQueries.secondArgAfterSearchQuery.position
    );
    expect(getStatementPosition(token)).toEqual(StatementPosition.SearchFuncSecondArg);
  });

  it('returns SearchFuncThirdArg when in the third arg of a Search function', () => {
    const token = createToken(
      MetricMathTestQueries.thirdArgAfterSearchQuery.query,
      MetricMathTestQueries.thirdArgAfterSearchQuery.position
    );
    expect(getStatementPosition(token)).toEqual(StatementPosition.SearchFuncThirdArg);
  });
  it('returns AfterFunction when after a function', () => {
    const token = createToken(
      MetricMathTestQueries.afterFunctionQuery.query,
      MetricMathTestQueries.afterFunctionQuery.position
    );
    expect(getStatementPosition(token)).toEqual(StatementPosition.AfterFunction);
  });

  it('returns WithinString when within a string', () => {
    const token = createToken(
      MetricMathTestQueries.withinStringQuery.query,
      MetricMathTestQueries.withinStringQuery.position
    );
    expect(getStatementPosition(token)).toEqual(StatementPosition.WithinString);
  });
});
