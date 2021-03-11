import { ReducerID } from '@grafana/data';
import { ExpressionQuery, GELQueryType } from '../types';

export const getDefaults = (query: ExpressionQuery) => {
  if (query.type === GELQueryType.reduce) {
    if (!query.reducer) {
      query.reducer = ReducerID.mean;
    }
    query.expression = undefined;
  } else if (query.type === GELQueryType.resample) {
    if (!query.downsampler) {
      query.downsampler = ReducerID.mean;
    }
    if (!query.upsampler) {
      query.upsampler = 'fillna';
    }
    query.reducer = undefined;
  } else {
    query.reducer = undefined;
  }

  return query;
};
