import { from, lastValueFrom, map, mergeMap, type Observable } from 'rxjs';

import {
  type DataFrame,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  FieldType,
  isDataFrame,
  PluginType,
  type ScopedVars,
  type TimeRange,
} from '@grafana/data';
import { type SQLQuery } from '@grafana/plugin-ui';
import {
  type BackendDataSourceResponse,
  DataSourceWithBackend,
  type FetchResponse,
  getBackendSrv,
  getTemplateSrv,
  isExpressionReference,
  toDataQueryResponse,
} from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';
import icnDatasourceSvg from 'img/icn-datasource.svg';

import { ExpressionQueryEditor } from './ExpressionQueryEditor';
import { isClassicExpression, isResampleExpression, type ExpressionQuery } from './schemas/expressionQuery';
import { makeExpression, makeSqlExpression } from './schemas/factories';
import { ExpressionDatasourceUID, ExpressionQueryType } from './types';

const SQL_DISPLAY_NAME_FIELD = '__display_name__';
const SQL_VALUE_FIELD = '__value__';
// Source frames consumed by SQL expressions are returned with these internal full-long conversion types.
const SQL_FULL_LONG_FRAME_TYPES = new Set(['numeric-full-long', 'timeseries-full-long']);

function restoreSQLDisplayName(frame: DataFrame): DataFrame {
  const displayFields = frame.fields.filter((field) => field.name === SQL_DISPLAY_NAME_FIELD);
  const valueFields = frame.fields.filter((field) => field.name === SQL_VALUE_FIELD && field.type === FieldType.number);
  if (displayFields.length !== 1 || valueFields.length !== 1) {
    return frame;
  }

  // A field-level display name can only describe one series. Multi-series full-long frames interleave
  // names per row and need to be partitioned into separate series before their aliases can be restored.
  const displayName = displayFields[0].values[0];
  if (
    typeof displayName !== 'string' ||
    displayName.length === 0 ||
    !displayFields[0].values.every((value) => value === displayName)
  ) {
    return frame;
  }

  const valueField = valueFields[0];
  return {
    ...frame,
    fields: frame.fields.map((field) =>
      field === valueField
        ? { ...field, config: { ...field.config, displayNameFromDS: displayName }, state: null }
        : field
    ),
  };
}

function restoreSQLDisplayNames(response: DataQueryResponse, queries: ExpressionQuery[]): DataQueryResponse {
  const sqlRefIds = new Set(
    queries
      .filter((query) => isExpressionReference(query.datasource) && query.type === ExpressionQueryType.sql)
      .map((query) => query.refId)
  );
  if (sqlRefIds.size === 0) {
    return response;
  }

  const queryRefIds = new Set(queries.map((query) => query.refId));
  return {
    ...response,
    data: response.data.map((frame) =>
      isDataFrame(frame) &&
      frame.refId &&
      (sqlRefIds.has(frame.refId) ||
        (queryRefIds.has(frame.refId) && SQL_FULL_LONG_FRAME_TYPES.has(frame.meta?.type ?? '')))
        ? restoreSQLDisplayName(frame)
        : frame
    ),
  };
}

/**
 * This is a singleton instance that just pretends to be a DataSource
 */
export class ExpressionDatasourceApi extends DataSourceWithBackend<ExpressionQuery> {
  constructor(public instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  applyTemplateVariables(query: ExpressionQuery, scopedVars: ScopedVars): ExpressionQuery {
    const templateSrv = getTemplateSrv();

    // Classic conditions have no expression of their own - each condition names its own query.
    if (isClassicExpression(query)) {
      return query;
    }

    const interpolated = { ...query, expression: templateSrv.replace(query.expression, scopedVars) };

    return isResampleExpression(interpolated)
      ? { ...interpolated, window: templateSrv.replace(interpolated.window, scopedVars) }
      : interpolated;
  }

  getCollapsedText(query: ExpressionQuery) {
    return `Expression: ${query.type}`;
  }

  query(request: DataQueryRequest<ExpressionQuery>): Observable<DataQueryResponse> {
    let targets = request.targets.map(async (query: ExpressionQuery): Promise<ExpressionQuery> => {
      const ds = await getDataSourceInstance(query.datasource, request.scopedVars);

      if (!ds.interpolateVariablesInQueries) {
        return query;
      }

      return ds?.interpolateVariablesInQueries([query], request.scopedVars, request.filters)[0] as ExpressionQuery;
    });

    let sub = from(Promise.all(targets));
    return sub.pipe(
      mergeMap((queries) =>
        super.query({ ...request, targets: queries }).pipe(map((response) => restoreSQLDisplayNames(response, queries)))
      )
    );
  }

  /**
   * Builds an empty expression. Types that need conditions get their default one from the
   * factories, so callers no longer have to remember to seed them.
   */
  newQuery(query?: {
    type?: ExpressionQueryType;
    refId?: string;
    hide?: boolean;
    datasource?: ExpressionQuery['datasource'];
    expression?: string;
  }): ExpressionQuery {
    return makeExpression(
      query?.type ?? ExpressionQueryType.math,
      {
        refId: query?.refId ?? '--', // Replaced with query
        hide: query?.hide,
        datasource: query?.datasource,
      },
      query?.expression
    );
  }

  runMetaSQLExprQuery(request: Partial<SQLQuery>, range: TimeRange, queries: DataQuery[]): Promise<DataFrame> {
    const refId = request.refId || 'meta';
    const metaSqlExpressionQuery = makeSqlExpression({ refId, hide: false }, { expression: request.rawSql ?? '' });
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
