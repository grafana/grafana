import InfluxQueryModel from '../influx_query_model';
import { InfluxQuery } from '../types';

// FIXME: these functions are a beginning of a refactoring of influx_query_model.ts
// into a simpler approach with full typescript types.
// later we should be able to migrate the unit-tests
// that relate to these functions here, and then perhaps even move the implementation
// to this place

export function buildRawQuery(query: InfluxQuery): string {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  return model.render(false);
}

export function normalizeQuery(query: InfluxQuery): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  return new InfluxQueryModel(queryCopy).target;
}

export function addNewSelectPart(query: InfluxQuery, type: string, index: number): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  model.addSelectPart(model.selectModels[index], type);
  return model.target;
}

export function removeSelectPart(query: InfluxQuery, partIndex: number, index: number): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  const selectModel = model.selectModels[index];
  model.removeSelectPart(selectModel, selectModel[partIndex]);
  return model.target;
}

export function addNewGroupByPart(query: InfluxQuery, type: string): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  model.addGroupBy(type);
  return model.target;
}

export function removeGroupByPart(query: InfluxQuery, partIndex: number): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  model.removeGroupByPart(model.groupByParts[partIndex], partIndex);
  return model.target;
}
