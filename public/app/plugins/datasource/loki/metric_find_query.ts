import { LokiDatasource } from './datasource';

export default class LokiMetricFindQuery {
  constructor(private datasource: LokiDatasource, private query: string) {
    this.datasource = datasource;
    this.query = query;
  }

  process() {
    const labelNamesRegex = /^label_names\(\)\s*$/;
    const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;

    const labelNamesQuery = this.query.match(labelNamesRegex);
    if (labelNamesQuery) {
      return this.labelNamesQuery();
    }

    const labelValuesQuery = this.query.match(labelValuesRegex);
    if (labelValuesQuery) {
      return this.labelValuesQuery(labelValuesQuery[2]);
    }

    return Promise.resolve([]);
  }

  async labelNamesQuery() {
    const url = '/loki/api/v1/label';
    const result = await this.datasource.metadataRequest(url);
    return result.data.data.map((value: string) => ({ text: value }));
  }

  async labelValuesQuery(label: string) {
    const url = `/loki/api/v1/label/${label}/values`;
    const result = await this.datasource.metadataRequest(url);
    return result.data.data.map((value: string) => ({ text: value }));
  }
}
