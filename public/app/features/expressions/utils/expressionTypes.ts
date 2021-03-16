import { ReducerID } from '@grafana/data';
import { ExpressionQuery, ExpressionQueryType } from '../types';

export const getDefaults = (query: ExpressionQuery) => {
  switch (query.type) {
    case ExpressionQueryType.reduce:
      if (!query.reducer) {
        query.reducer = ReducerID.mean;
      }
      query.expression = undefined;
      break;

    case ExpressionQueryType.resample:
      if (!query.downsampler) {
        query.downsampler = ReducerID.mean;
      }

      if (!query.upsampler) {
        query.upsampler = 'fillna';
      }

      query.reducer = undefined;
      break;

    case ExpressionQueryType.classic:
      if (!query.conditions) {
        query.conditions = [
          {
            type: 'query',
            reducer: {
              params: [],
              type: 'avg',
            },
            query: { params: ['A'] },
            evaluator: {
              params: [2],
              type: 'gt',
            },
          },
        ];
      }
      break;

    default:
      query.reducer = undefined;
  }

  return query;
};
