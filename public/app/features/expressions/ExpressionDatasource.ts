import { DataSourceInstanceSettings, DataSourcePluginMeta, PluginType } from '@grafana/data';
import { ExpressionQuery, ExpressionQueryType } from './types';
import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { DataSourceWithBackend } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';

/**
 * This is a singleton instance that just pretends to be a DataSource
 */
export class ExpressionDatasourceApi extends DataSourceWithBackend<ExpressionQuery> {
  constructor(public instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  getCollapsedText(query: ExpressionQuery) {
    return `Expression: ${query.type}`;
  }

  newQuery(query?: Partial<ExpressionQuery>): ExpressionQuery {
    return {
      refId: '--', // Replaced with query
      type: query?.type ?? ExpressionQueryType.math,
      datasource: ExpressionDatasourceRef,
      conditions: query?.conditions ?? undefined,
    };
  }
}

/**
 * MATCHES a constant in DataSourceWithBackend, this should be '__expr__'
 * @deprecated
 */
export const ExpressionDatasourceUID = '-100';

export const instanceSettings: DataSourceInstanceSettings = {
  id: -100,
  uid: ExpressionDatasourceUID,
  name: ExpressionDatasourceRef.type,
  type: ExpressionDatasourceRef.type,
  access: 'proxy',
  meta: {
    baseUrl: '',
    module: '',
    type: PluginType.datasource,
    name: ExpressionDatasourceRef.type,
    id: ExpressionDatasourceRef.type,
    info: {
      author: {
        name: 'Grafana Labs',
      },
      logos: {
        small: 'public/img/icn-datasource.svg',
        large: 'public/img/icn-datasource.svg',
      },
      description: 'Adds expression support to Grafana',
      screenshots: [],
      links: [],
      updated: '',
      version: '',
    },
  },
  jsonData: {},
};

export const dataSource = new ExpressionDatasourceApi(instanceSettings);
dataSource.meta = {
  id: ExpressionDatasourceRef.type,
  info: {
    logos: {
      small: 'public/img/icn-datasource.svg',
      large: 'public/img/icn-datasource.svg',
    },
  },
} as DataSourcePluginMeta;
dataSource.components = {
  QueryEditor: ExpressionQueryEditor,
};
