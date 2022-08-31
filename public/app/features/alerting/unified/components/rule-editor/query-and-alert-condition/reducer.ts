import { PanelData, DataQuery, RelativeTimeRange, getDefaultRelativeTimeRange } from '@grafana/data';
import { getNextRefIdChar } from 'app/core/utils/query';
import {
  dataSource as expressionDatasource,
  ExpressionDatasourceUID,
} from 'app/features/expressions/ExpressionDatasource';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { getDefaultOrFirstCompatibleDataSource } from '../../../utils/datasource';
import { refIdExists } from '../util';

interface State {
  queries: AlertQuery[];
  panelData: Record<string, PanelData>;
}

type Action =
  | UpdatePanelDataAction
  | AddNewDataQuery
  | SetDataQueries
  | AddNewExpression
  | RemoveExpression
  | UpdateExpression
  | UpdateExpressionRefId
  | UpdateExpressionType;

// panel data actions
type UpdatePanelDataAction = { type: 'updatePanelData'; payload: Record<string, PanelData> };

// data queries actions
type AddNewDataQuery = { type: 'addNewDataQuery' };
type SetDataQueries = { type: 'setDataQueries'; payload: AlertQuery[] };

// expressions actions
type AddNewExpression = { type: 'addNewExpression' };
type RemoveExpression = { type: 'removeExpression'; payload: string };
type UpdateExpression = { type: 'updateExpression'; payload: ExpressionQuery };
type UpdateExpressionRefId = { type: 'updateExpressionRefId'; payload: { oldRefId: string; newRefId: string } };
type UpdateExpressionType = { type: 'updateExpressionType'; payload: { refId: string; type: ExpressionQueryType } };

export function queriesAndExpressionsReducer(state: State, action: Action): State {
  const { queries } = state;

  switch (action.type) {
    case 'updatePanelData':
      return { ...state, panelData: action.payload };
    case 'addNewDataQuery':
      const datasource = getDefaultOrFirstCompatibleDataSource();
      if (!datasource) {
        return state;
      }

      return {
        ...state,
        queries: addQuery(state.queries, {
          datasourceUid: datasource.uid,
          model: {
            refId: '',
            datasource: {
              type: datasource.type,
              uid: datasource.uid,
            },
          },
        }),
      };
    case 'setDataQueries':
      const expressionQueries = state.queries.filter((query) => isExpressionQuery(query.model));

      return {
        ...state,
        queries: [...action.payload, ...expressionQueries],
      };
    case 'addNewExpression':
      return {
        ...state,
        queries: addQuery(state.queries, {
          datasourceUid: ExpressionDatasourceUID,
          model: expressionDatasource.newQuery({
            type: ExpressionQueryType.classic,
            conditions: [{ ...defaultCondition, query: { params: [] } }],
            expression: '',
          }),
        }),
      };
    case 'removeExpression':
      return {
        ...state,
        queries: queries.filter((query) => query.refId !== action.payload),
      };
    case 'updateExpressionRefId':
      const { newRefId, oldRefId } = action.payload;

      // if the new refId already exists we just refuse to update the state
      const newRefIdExists = refIdExists(state.queries, newRefId);
      if (newRefIdExists) {
        return state;
      }

      return {
        ...state,
        queries: queries.map((query) => {
          if (query.refId === oldRefId) {
            return {
              ...query,
              refId: newRefId,
              model: {
                ...query.model,
                refId: newRefId,
              },
            };
          }

          return query;
        }),
      };
    case 'updateExpressionType':
      return {
        ...state,
        queries: queries.map((query) => {
          return query.refId === action.payload.refId
            ? {
                ...query,
                model: {
                  ...expressionDatasource.newQuery({
                    type: action.payload.type,
                    conditions: [{ ...defaultCondition, query: { params: [] } }],
                    expression: '',
                  }),
                  refId: action.payload.refId,
                },
              }
            : query;
        }),
      };
    case 'updateExpression':
      return {
        ...state,
        queries: queries.map((query) => {
          return query.refId === action.payload.refId
            ? {
                ...query,
                model: action.payload,
              }
            : query;
        }),
      };
    default:
      return state;
  }
}

const addQuery = (queries: AlertQuery[], queryToAdd: Pick<AlertQuery, 'model' | 'datasourceUid'>): AlertQuery[] => {
  const refId = getNextRefIdChar(queries);

  const query: AlertQuery = {
    ...queryToAdd,
    refId,
    queryType: '',
    model: {
      ...queryToAdd.model,
      hide: false,
      refId,
    },
    relativeTimeRange: defaultTimeRange(queryToAdd.model),
  };

  return [...queries, query];
};

const defaultTimeRange = (model: DataQuery): RelativeTimeRange | undefined => {
  if (isExpressionQuery(model)) {
    return;
  }

  return getDefaultRelativeTimeRange();
};
