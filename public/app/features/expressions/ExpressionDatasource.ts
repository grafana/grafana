import { Observable, from, mergeMap } from 'rxjs';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
  PluginType,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';

import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { ExpressionQuery, ExpressionQueryType } from './types';

/**
 * This is a singleton instance that just pretends to be a DataSource
 */
export class ExpressionDatasourceApi extends DataSourceWithBackend<ExpressionQuery> {
  constructor(public instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  applyTemplateVariables(query: ExpressionQuery, scopedVars: ScopedVars): Record<string, any> {
    const templateSrv = getTemplateSrv();
    return {
      ...query,
      expression: templateSrv.replace(query.expression, scopedVars),
      window: templateSrv.replace(query.window, scopedVars),
    };
  }

  getCollapsedText(query: ExpressionQuery) {
    return `Expression: ${query.type}`;
  }

  query(request: DataQueryRequest<ExpressionQuery>): Observable<DataQueryResponse> {
    let targets = request.targets.map(async (query: ExpressionQuery): Promise<ExpressionQuery> => {
      const ds = await getDataSourceSrv().get(query.datasource);

      if (!ds.interpolateVariablesInQueries) {
        return query;
      }

      return ds?.interpolateVariablesInQueries([query], request.scopedVars)[0] as ExpressionQuery;
    });

    let sub = from(Promise.all(targets));
    return sub.pipe(mergeMap((t) => super.query({ ...request, targets: t })));
  }

  newQuery(query?: Partial<ExpressionQuery>): ExpressionQuery {
    return {
      refId: '--', // Replaced with query
      datasource: ExpressionDatasourceRef,
      type: query?.type ?? ExpressionQueryType.math,
      ...query,
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
  name: ExpressionDatasourceRef.name,
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
  readOnly: true,
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
