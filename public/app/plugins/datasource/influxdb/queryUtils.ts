import { cloneDeep } from 'lodash';

import InfluxQueryModel from './influx_query_model';
import { InfluxQuery } from './types';

// FIXME: these functions are a beginning of a refactoring of influx_query_model.ts
// into a simpler approach with full typescript types.
// later we should be able to migrate the unit-tests
// that relate to these functions here, and then perhaps even move the implementation
// to this place

export function buildRawQuery(query: InfluxQuery): string {
  const queryCopy = cloneDeep(query); // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  return model.render(false);
}

export function normalizeQuery(query: InfluxQuery): InfluxQuery {
  // we return the original query if there is no need to update it
  if (
    query.policy !== undefined &&
    query.resultFormat !== undefined &&
    query.orderByTime !== undefined &&
    query.tags !== undefined &&
    query.groupBy !== undefined &&
    query.select !== undefined
  ) {
    return query;
  }

  // FIXME: we should move the whole normalizeQuery logic here,
  // and then have influxQueryModel call this function,
  // to concentrate the whole logic here

  const queryCopy = cloneDeep(query); // the query-model mutates the query
  return new InfluxQueryModel(queryCopy).target;
}

export function addNewSelectPart(query: InfluxQuery, type: string, index: number): InfluxQuery {
  const queryCopy = cloneDeep(query); // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  model.addSelectPart(model.selectModels[index], type);
  return model.target;
}

export function removeSelectPart(query: InfluxQuery, partIndex: number, index: number): InfluxQuery {
  const queryCopy = cloneDeep(query); // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  const selectModel = model.selectModels[index];
  model.removeSelectPart(selectModel, selectModel[partIndex]);
  return model.target;
}

export function changeSelectPart(
  query: InfluxQuery,
  listIndex: number,
  partIndex: number,
  newParams: string[]
): InfluxQuery {
  // we need to make shallow copy of `query.select` down to `query.select[listIndex][partIndex]`
  const newSel = [...(query.select ?? [])];
  newSel[listIndex] = [...newSel[listIndex]];
  newSel[listIndex][partIndex] = {
    ...newSel[listIndex][partIndex],
    params: newParams,
  };
  return { ...query, select: newSel };
}

export function addNewGroupByPart(query: InfluxQuery, type: string): InfluxQuery {
  const queryCopy = cloneDeep(query); // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  model.addGroupBy(type);
  return model.target;
}

export function removeGroupByPart(query: InfluxQuery, partIndex: number): InfluxQuery {
  const queryCopy = cloneDeep(query); // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  model.removeGroupByPart(model.groupByParts[partIndex], partIndex);
  return model.target;
}

export function changeGroupByPart(query: InfluxQuery, partIndex: number, newParams: string[]): InfluxQuery {
  // we need to make shallow copy of `query.groupBy` down to `query.groupBy[partIndex]`
  const newGroupBy = [...(query.groupBy ?? [])];
  newGroupBy[partIndex] = {
    ...newGroupBy[partIndex],
    params: newParams,
  };
  return { ...query, groupBy: newGroupBy };
}
