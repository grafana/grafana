import { LokiDatasource } from './datasource';
import { LokiVariableQuery, LokiVariableQueryType } from './types';

export class LokiMetricFindQuery {
  constructor(private datasource: LokiDatasource) {}

  async execute(query: LokiVariableQuery) {
    if (query.type === LokiVariableQueryType.labelNames) {
      return this.datasource.labelNamesQuery();
    }

    if (!query.label) {
      return [];
    }

    // If we have query expr, use /series endpoint
    if (query.stream) {
      return this.datasource.labelValuesSeriesQuery(query.stream, query.label);
    }

    return this.datasource.labelValuesQuery(query.label);
  }
}
