import { escapeRegExp } from 'lodash';
import { from, lastValueFrom, map, mergeMap, type Observable } from 'rxjs';

import {
  type DataFrame,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceApi,
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
  getDataSourceInstance,
} from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';
import icnDatasourceSvg from 'img/icn-datasource.svg';

import { ExpressionQueryEditorLazy } from './ExpressionQueryEditorLazy';
import { ExpressionDatasourceUID, type ExpressionQuery, ExpressionQueryType } from './types';

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

// A refId counts as used when it appears as a whole word, ignoring case, in an expression or a
// classic condition. So `A` matches `$A`, `${A}` and `FROM a`, but not `SELECT`. The check errs
// toward keeping a query: a false match only sends a query that the backend gets today anyway.
function getUsedRefIdMatcher(request: DataQueryRequest<ExpressionQuery>): (refId: string) => boolean {
  const templateSrv = getTemplateSrv();
  const texts = request.targets
    .filter((query) => isExpressionReference(query.datasource))
    .flatMap((query) => [
      query.expression ?? '',
      templateSrv.replace(query.expression ?? '', request.scopedVars),
      ...(query.conditions ?? []).flatMap((condition) => condition.query?.params ?? []),
    ]);
  return (refId) => {
    const pattern = new RegExp(`(?<!\\w)${escapeRegExp(refId)}(?!\\w)`, 'i');
    return texts.some((text) => pattern.test(text));
  };
}

// Each data source gets all of its queries in one call, as it does in a panel, so it can resolve
// references between them (such as Graphite's `#A`). Results are matched back by refId because
// a data source may return them in a different order.
async function interpolateQueriesByDataSource(request: DataQueryRequest<ExpressionQuery>): Promise<ExpressionQuery[]> {
  const resolved = await Promise.all(
    request.targets.map((query) => getDataSourceInstance(query.datasource, request.scopedVars))
  );

  // Without an expression, `runRequest` drops queries that fail their data source's `filterQuery`,
  // such as empty or hidden queries. A request with an expression comes here before that step, so
  // drop them here too. Keep a query that an expression uses: hidden queries are often SQL expression
  // inputs, and an expression that uses an empty query should fail as it does today.
  const isUsed = getUsedRefIdMatcher(request);
  const keep = request.targets.map(
    (query, i) =>
      isExpressionReference(query.datasource) || isUsed(query.refId) || (resolved[i].filterQuery?.(query) ?? true)
  );
  const instances = resolved.filter((_, i) => keep[i]);
  request = { ...request, targets: request.targets.filter((_, i) => keep[i]) };

  const groups = new Map<string | undefined, { ds: DataSourceApi; indexes: number[] }>();
  instances.forEach((ds, i) => {
    const group = groups.get(ds.uid) ?? { ds, indexes: [] };
    group.indexes.push(i);
    groups.set(ds.uid, group);
  });

  const result = [...request.targets];
  for (const { ds, indexes } of groups.values()) {
    if (!ds.interpolateVariablesInQueries) {
      continue;
    }
    const queries = indexes.map((i) => request.targets[i]);
    const byRefId = new Map(
      ds.interpolateVariablesInQueries(queries, request.scopedVars, request.filters).map((q) => [q.refId, q])
    );
    for (const i of indexes) {
      result[i] = (byRefId.get(request.targets[i].refId) as ExpressionQuery | undefined) ?? request.targets[i];
    }
  }

  return result;
}

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
    return from(interpolateQueriesByDataSource(request)).pipe(
      mergeMap((queries) =>
        super.query({ ...request, targets: queries }).pipe(map((response) => restoreSQLDisplayNames(response, queries)))
      )
    );
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
            // Parse only the meta expression's result: source query frames are not the SQL-converted
            // columns, and hidden source queries are omitted from the response entirely.
            const rsp = toDataQueryResponse(res, [metaSqlExpressionQuery]);
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
  QueryEditor: ExpressionQueryEditorLazy,
};
