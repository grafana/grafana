import { monacoTypes } from '@grafana/ui';

import { afterFunctionQuery } from '../../../mocks/metric-math-test-data/afterFunctionQuery';
import { secondArgAfterSearchQuery } from '../../../mocks/metric-math-test-data/secondArgAfterSearchQuery';
import { secondArgQuery } from '../../../mocks/metric-math-test-data/secondArgQuery';
import { singleLineEmptyQuery } from '../../../mocks/metric-math-test-data/singleLineEmptyQuery';
import { thirdArgAfterSearchQuery } from '../../../mocks/metric-math-test-data/thirdArgAfterSearchQuery';
import { withinStringQuery } from '../../../mocks/metric-math-test-data/withinStringQuery';
import MonacoMock from '../../../mocks/monarch/Monaco';
import TextModel from '../../../mocks/monarch/TextModel';
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
    const token = createToken(singleLineEmptyQuery.query, singleLineEmptyQuery.position);
    expect(getStatementPosition(token)).toEqual(StatementPosition.PredefinedFunction);
  });

  it('returns PredefinedFuncSecondArg when in the second arg of a predefined function', () => {
    const token = createToken(secondArgQuery.query, secondArgQuery.position);
    expect(getStatementPosition(token)).toEqual(StatementPosition.PredefinedFuncSecondArg);
  });

  it('returns SearchFuncSecondArg when in the second arg of a Search function', () => {
    const token = createToken(secondArgAfterSearchQuery.query, secondArgAfterSearchQuery.position);
    expect(getStatementPosition(token)).toEqual(StatementPosition.SearchFuncSecondArg);
  });

  it('returns SearchFuncThirdArg when in the third arg of a Search function', () => {
    const token = createToken(thirdArgAfterSearchQuery.query, thirdArgAfterSearchQuery.position);
    expect(getStatementPosition(token)).toEqual(StatementPosition.SearchFuncThirdArg);
  });
  it('returns AfterFunction when after a function', () => {
    const token = createToken(afterFunctionQuery.query, afterFunctionQuery.position);
    expect(getStatementPosition(token)).toEqual(StatementPosition.AfterFunction);
  });

  it('returns WithinString when within a string', () => {
    const token = createToken(withinStringQuery.query, withinStringQuery.position);
    expect(getStatementPosition(token)).toEqual(StatementPosition.WithinString);
  });
});
