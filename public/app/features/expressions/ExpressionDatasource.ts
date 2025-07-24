import { from, lastValueFrom, map, mergeMap, Observable } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
  PluginType,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { SQLQuery } from '@grafana/plugin-ui';
import {
  BackendDataSourceResponse,
  DataSourceWithBackend,
  FetchResponse,
  getBackendSrv,
  getDataSourceSrv,
  getTemplateSrv,
  toDataQueryResponse,
} from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { DataQuery } from '@grafana/schema/dist/esm/index';
import icnDatasourceSvg from 'img/icn-datasource.svg';

import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { ExpressionDatasourceUID, ExpressionQuery, ExpressionQueryType } from './types';

/**
 * This is a singleton instance that just pretends to be a DataSource
 */
export class ExpressionDatasourceApi extends DataSourceWithBackend<ExpressionQuery> {
  constructor(public instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  applyTemplateVariables(query: ExpressionQuery, scopedVars: ScopedVars) {
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

      return ds?.interpolateVariablesInQueries([query], request.scopedVars, request.filters)[0] as ExpressionQuery;
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

  runMetaSQLExprQuery(request: Partial<SQLQuery>, range: TimeRange, queries: DataQuery[]): Promise<DataFrame> {
    const refId = request.refId || 'meta';
    const metaSqlExpressionQuery: ExpressionQuery = {
      window: '',
      hide: false,
      expression: request.rawSql,
      datasource: ExpressionDatasourceRef,
      refId,
      type: ExpressionQueryType.sql,
    };
    return lastValueFrom(
      getBackendSrv()
        .fetch<BackendDataSourceResponse>({
          url: '/api/ds/query',
          method: 'POST',
          headers: this.getRequestHeaders(),
          data: {
            from: range.from.valueOf().toString(),
            to: range.to.valueOf().toString(),
            queries: [...queries, metaSqlExpressionQuery],
          },
          requestId: refId,
        })
        .pipe(
          map((res: FetchResponse<BackendDataSourceResponse>) => {
            const rsp = toDataQueryResponse(res, queries);
            return rsp.data[0] ?? { fields: [] };
          })
        )
    );
  }
}

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
        small: icnDatasourceSvg,
        large: icnDatasourceSvg,
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
      small: icnDatasourceSvg,
      large: icnDatasourceSvg,
    },
  },
} as DataSourcePluginMeta;
dataSource.components = {
  QueryEditor: ExpressionQueryEditor,
};
