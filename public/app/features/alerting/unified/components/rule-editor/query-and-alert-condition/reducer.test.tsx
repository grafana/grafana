import { getDefaultRelativeTimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime/src/services/__mocks__/dataSourceSrv';
import {
  dataSource as expressionDatasource,
  ExpressionDatasourceUID,
} from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import {
  addNewDataQuery,
  addNewExpression,
  duplicateQuery,
  queriesAndExpressionsReducer,
  QueriesAndExpressionsState,
  removeExpression,
  rewireExpressions,
  setDataQueries,
  updateExpression,
  updateExpressionRefId,
  updateExpressionType,
} from './reducer';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: getDataSourceSrv,
}));

const alertQuery: AlertQuery = {
  refId: 'A',
  queryType: 'query',
  datasourceUid: 'abc123',
  model: {
    refId: 'A',
  },
};

const expressionQuery: AlertQuery = {
  datasourceUid: ExpressionDatasourceUID,
  model: expressionDatasource.newQuery({
    type: ExpressionQueryType.classic,
    conditions: [{ ...defaultCondition, query: { params: ['A'] } }],
    expression: '',
    refId: 'B',
  }),
  refId: 'B',
  queryType: '',
};

describe('Query and expressions reducer', () => {
  it('should return initial state', () => {
    expect(queriesAndExpressionsReducer(undefined, { type: undefined })).toEqual({
      queries: [],
    });
  });

  it('should duplicate query', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery],
    };

    const newState = queriesAndExpressionsReducer(initialState, duplicateQuery(alertQuery));
    const newQuery = newState.queries.at(-1);
    expect(newState).toMatchSnapshot();
    expect(newQuery).toHaveProperty('relativeTimeRange', getDefaultRelativeTimeRange());
  });

  it('should duplicate query and copy time range', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery],
    };

    const customTimeRange = {
      from: -200,
      to: 800,
    };

    const query: AlertQuery = {
      ...initialState.queries[0],
      relativeTimeRange: customTimeRange,
    };

    const previousState: QueriesAndExpressionsState = {
      queries: [query],
    };

    const newState = queriesAndExpressionsReducer(previousState, duplicateQuery(query));
    const newQuery = newState.queries.at(-1);
    expect(newQuery).toHaveProperty('relativeTimeRange', customTimeRange);
  });

  it('should add query', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery],
    };

    const newState = queriesAndExpressionsReducer(initialState, addNewDataQuery());
    expect(newState.queries).toHaveLength(2);
    expect(newState).toMatchSnapshot();
  });

  it('should set data queries', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery, expressionQuery],
    };

    const newState = queriesAndExpressionsReducer(initialState, setDataQueries([]));
    expect(newState.queries).toHaveLength(1);
    expect(newState).toMatchSnapshot();
  });

  it('should add a new expression', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery],
    };

    const newState = queriesAndExpressionsReducer(initialState, addNewExpression());
    expect(newState.queries).toHaveLength(2);
    expect(newState).toMatchSnapshot();
  });

  it('should remove an expression or alert query', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery, expressionQuery],
    };

    let stateWithoutB = queriesAndExpressionsReducer(initialState, removeExpression('B'));
    expect(stateWithoutB.queries).toHaveLength(1);
    expect(stateWithoutB).toMatchSnapshot();

    let stateWithoutAOrB = queriesAndExpressionsReducer(stateWithoutB, removeExpression('A'));
    expect(stateWithoutAOrB.queries).toHaveLength(0);
  });

  it('should update an expression', () => {
    const newExpression: ExpressionQuery = {
      ...expressionQuery.model,
      type: ExpressionQueryType.math,
    };

    const initialState: QueriesAndExpressionsState = {
      queries: [expressionQuery],
    };

    const newState = queriesAndExpressionsReducer(initialState, updateExpression(newExpression));
    expect(newState).toMatchSnapshot();
  });

  it('should update an expression refId and rewire expressions', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery, expressionQuery],
    };

    const newState = queriesAndExpressionsReducer(
      initialState,
      updateExpressionRefId({
        oldRefId: 'A',
        newRefId: 'C',
      })
    );

    expect(newState).toMatchSnapshot();
  });

  it('should not update an expression when the refId exists', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery, expressionQuery],
    };

    const newState = queriesAndExpressionsReducer(
      initialState,
      updateExpressionRefId({
        oldRefId: 'A',
        newRefId: 'B',
      })
    );

    expect(newState).toEqual(initialState);
  });

  it('should rewire expressions', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery, expressionQuery],
    };

    const newState = queriesAndExpressionsReducer(
      initialState,
      rewireExpressions({
        oldRefId: 'A',
        newRefId: 'C',
      })
    );

    expect(newState).toMatchSnapshot();
  });

  it('should update expression type', () => {
    const initialState: QueriesAndExpressionsState = {
      queries: [alertQuery, expressionQuery],
    };

    const newState = queriesAndExpressionsReducer(
      initialState,
      updateExpressionType({
        refId: 'B',
        type: ExpressionQueryType.reduce,
      })
    );

    expect(newState).toMatchSnapshot();
  });
});
