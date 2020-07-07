import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import { ExpressionQuery, GELQueryType } from './types';
import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { DataSourceWithBackend } from '@grafana/runtime';

/**
 * This is a singleton instance that just pretends to be a DataSource
 */
export class ExpressionDatasourceApi extends DataSourceWithBackend<ExpressionQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  getCollapsedText(query: ExpressionQuery) {
    return `Expression: ${query.type}`;
  }

  newQuery(): ExpressionQuery {
    return {
      refId: '--', // Replaced with query
      type: GELQueryType.math,
      datasource: ExpressionDatasourceID,
    };
  }
}

// MATCHES the constant in DataSourceWithBackend
export const ExpressionDatasourceID = '__expr__';

export const expressionDatasource = new ExpressionDatasourceApi({
  id: -100,
  name: ExpressionDatasourceID,
} as DataSourceInstanceSettings);
expressionDatasource.meta = {
  id: ExpressionDatasourceID,
  info: {
    logos: {
      small: 'public/img/icn-datasource.svg',
      large: 'public/img/icn-datasource.svg',
    },
  },
} as DataSourcePluginMeta;
expressionDatasource.components = {
  QueryEditor: ExpressionQueryEditor,
};
