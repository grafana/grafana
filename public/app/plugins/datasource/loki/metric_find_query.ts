import { map } from 'lodash';
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

  labelNamesQuery() {
    const url = '/loki/api/v1/label';
    return this.datasource.metadataRequest(url).then((result: any) => {
      return map(result.data.data, value => {
        return { text: value };
      });
    });
  }

  labelValuesQuery(label: string) {
    let url: string;
    url = '/loki/api/v1/label/' + label + '/values';
    return this.datasource.metadataRequest(url).then((result: any) => {
      return map(result.data.data, value => {
        return { text: value };
      });
    });
  }
}
