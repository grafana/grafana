import { LokiDatasource } from './datasource';

export async function processMetricFindQuery(datasource: LokiDatasource, query: string) {
  const labelNamesRegex = /^label_names\(\)\s*$/;
  const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;

  const labelNames = query.match(labelNamesRegex);
  if (labelNames) {
    return await labelNamesQuery(datasource);
  }

  const labelValues = query.match(labelValuesRegex);
  if (labelValues) {
    return await labelValuesQuery(datasource, labelValues[2]);
  }

  return Promise.resolve([]);
}

async function labelNamesQuery(datasource: LokiDatasource) {
  const url = '/loki/api/v1/label';
  const result = await datasource.metadataRequest(url);
  return result.data.data.map((value: string) => ({ text: value }));
}

async function labelValuesQuery(datasource: LokiDatasource, label: string) {
  const url = `/loki/api/v1/label/${label}/values`;
  const result = await datasource.metadataRequest(url);
  return result.data.data.map((value: string) => ({ text: value }));
}
