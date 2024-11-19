import { lastValueFrom, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  getDefaultTimeRange,
  DataFrame,
  DataFrameView,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  MetricFindValue,
  ScopedVars,
  CoreApp,
  getSearchFilterScopedVar,
  LegacyMetricFindQueryOptions,
  VariableWithMultiSupport,
  TimeRange,
  DataSourceWithLogsContextSupport,
  LogRowContextOptions,
  LogRowModel,
  DataQueryError,
  LogRowContextQueryDirection,
  rangeUtil,
  toUtc,
  Labels,
  FieldCache,
  FieldType,
} from '@grafana/data';
import { EditorMode } from '@grafana/experimental';
import {
  BackendDataSourceResponse,
  DataSourceWithBackend,
  FetchResponse,
  getBackendSrv,
  getTemplateSrv,
  toDataQueryResponse,
  TemplateSrv,
  reportInteraction,
} from '@grafana/runtime';

import { ResponseParser } from '../ResponseParser';
import { SqlQueryEditor } from '../components/QueryEditor';
import { SimpleLogContextUi } from '../components/query-editor-raw/SimpleLogContextUi';
import { MACRO_NAMES } from '../constants';
import { DB, SQLQuery, SQLOptions, SqlQueryModel, QueryFormat } from '../types';
import migrateAnnotation from '../utils/migration';

import { isSqlDatasourceDatabaseSelectionFeatureFlagEnabled } from './../components/QueryEditorFeatureFlag.utils';

export abstract class SqlDatasource extends DataSourceWithBackend<SQLQuery, SQLOptions>
  implements DataSourceWithLogsContextSupport {
  id: number;
  responseParser: ResponseParser;
  name: string;
  interval: string;
  db: DB;
  preconfiguredDatabase: string;
  cachedSql: SQLQuery[];

  constructor(
    instanceSettings: DataSourceInstanceSettings<SQLOptions>,
    protected readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.name = instanceSettings.name;
    this.responseParser = new ResponseParser();
    this.id = instanceSettings.id;
    const settingsData = instanceSettings.jsonData || {};
    this.interval = settingsData.timeInterval || '1m';
    this.db = this.getDB();
    // this is used to store the sql queries that are used to get the log row context
    this.cachedSql = [];
    /*
      The `settingsData.database` will be defined if a default database has been defined in either
      1) the ConfigurationEditor.tsx, OR 2) the provisioning config file, either under `jsondata.database`, or simply `database`.
    */
    this.preconfiguredDatabase = settingsData.database ?? '';
    this.annotations = {
      prepareAnnotation: migrateAnnotation,
      QueryEditor: SqlQueryEditor,
    };
  }

  // private method used in the `getLogRowContext` to create a log context data request.
  private makeLogContextDataRequest = (row: LogRowModel, options?: LogRowContextOptions, orinQuery?: SQLQuery) => {
    const direction = options?.direction || LogRowContextQueryDirection.Backward;
    const contextTimeBuffer = 1 * 60 * 60 * 1000; // 1h buffer
    const fieldCache = new FieldCache(row.dataFrame);
    const tsField = fieldCache.getFirstFieldOfType(FieldType.time);
    if (tsField === undefined) {
      throw new Error('SQL DataSoure: data frame missing time-field, should never happen');
    }
    const tsValue = tsField.values[row.rowIndex];
    const timestamp = toUtc(tsValue);

    const timeRange =
      direction === LogRowContextQueryDirection.Forward
        ? {
          // start param in Loki API is inclusive so we'll have to filter out the row that this request is based from
          // and any other that were logged in the same ns but before the row. Right now these rows will be lost
          // because the are before but came it he response that should return only rows after.
          from: timestamp,
          // convert to ns, we lose some precision here but it is not that important at the far points of the context
          to: toUtc(row.timeEpochMs + contextTimeBuffer),
        }
        : {
          // convert to ns, we lose some precision here but it is not that important at the far points of the context
          from: toUtc(row.timeEpochMs - contextTimeBuffer),
          to: timestamp,
        };
    const range: TimeRange = {
      from: timeRange.from,
      to: timeRange.to,
      raw: timeRange,
    };

    const interval = rangeUtil.calculateInterval(range, 1);

    const duplicate: Labels = JSON.parse(JSON.stringify(row.labels));
    const scopedVars: ScopedVars = this.prepareScopeVars(duplicate);

    let sqlExpress: SQLQuery[] = []
    // cachedSql is used whit LogRowContextUi, but it has two http requests for log context. so
    // we must replace ordered keyword, e.g. ASC, DESC
    if (this.cachedSql.length > 0) {
      let sql: SQLQuery = JSON.parse(JSON.stringify(this.cachedSql[0]));
      if (direction === LogRowContextQueryDirection.Forward) {
        sql.rawSql = this.processOrderByClause(sql.rawSql || "", 'ASC');
      } else {
        sql.rawSql = this.processOrderByClause(sql.rawSql || "", 'DESC');
      }
      sqlExpress.push(sql);
    } else {
      if (orinQuery) {
        sqlExpress.push(this.prepareSqlExpress(duplicate, row, orinQuery))
      }
    }

    const contextRequest: DataQueryRequest<SQLQuery> = {
      requestId: `mysql-log-context-${row.dataFrame.refId}`,
      targets: sqlExpress,
      interval: interval.interval,
      intervalMs: interval.intervalMs,
      range,
      scopedVars: scopedVars,
      timezone: 'UTC',
      app: CoreApp.Explore,
      startTime: Date.now(),
      hideFromInspector: true,
    };
    return contextRequest;
  }

  prepareScopeVars(duplicate: Labels) {
    const scopedVars: ScopedVars = {}
    this.templateSrv.getVariables().map(v => {
      if (v.name in duplicate) {
        scopedVars[v.name] = { text: `'${duplicate[v.name]}'`, value: `'${duplicate[v.name]}'` };
        delete duplicate[v.name];
      }
    });
    return scopedVars;
  }

  prepareSqlExpress(duplicate: Labels, row: LogRowModel, orinQuery: SQLQuery): SQLQuery {
    const query = JSON.parse(JSON.stringify(orinQuery));
    let whereClause = 'WHERE ';
    const whereLiteral = this.getWhereLiteral(query.rawSql || "")
    if (whereLiteral.length > 0) {
      query.rawSql = query.rawSql?.replace(whereLiteral, whereClause);
    } else {
      const table = this.getTablename(query.rawSql || "");
      if (table.length > 0) {
        whereClause = table + whereClause + "1=1";
        query.rawSql = query.rawSql?.replace(table, whereClause);
      }
    }
    return query;
  }

  processOrderByClause(sql: string, keyword: 'ASC' | 'DESC'): string {
    const orderByRegex = /order\s+by\s+([\w.,\s]+?)(\s+asc|\s+desc)?(\s+|$)/i;
    if (!orderByRegex.test(sql)) {
      return sql; // not exist order by clause
    }
    return sql.replace(orderByRegex, (_, columns) => `ORDER BY ${columns.trim()} ${keyword} `);
  }

  getWhereLiteral(sql: string): string {
    const regex = /\bwhere\b/i;
    const match = sql.match(regex);
    if (match) {
      return match[0];
    }
    return "";
  }

  getTablename(sql: string): string {
    const regex = /from\s+(\S+)/i;
    const match = sql.match(regex);
    if (match) {
      return match[1];
    }
    return "";
  }

  // Acquire the log rows context from sql dataSource
  getLogRowContext(row: LogRowModel, options?: LogRowContextOptions, query?: SQLQuery): Promise<DataQueryResponse> {
    const contextRequest: DataQueryRequest<SQLQuery> = this.makeLogContextDataRequest(row, options, query);
    return lastValueFrom(
      this.query(contextRequest).pipe(
        catchError((err) => {
          const error: DataQueryError = {
            message: 'Error during context query. Please check JS console logs.',
            status: err.status,
            statusText: err.statusText,
          };
          throw error;
        })
      )
    );
  }

  getLogRowContextUi(row: LogRowModel, runContextQuery?: () => void, orignQuery?: SQLQuery): React.ReactNode {
    if (orignQuery === undefined) {
      return null;
    }
    const duplicate: Labels = JSON.parse(JSON.stringify(row.labels));
    const scopedVars: ScopedVars = this.prepareScopeVars(duplicate);
    const sqlExpress: SQLQuery = this.prepareSqlExpress(duplicate, row, orignQuery)
    sqlExpress.rawSql = this.templateSrv.replace(sqlExpress.rawSql, scopedVars, this.interpolateVariable);
    //sqlExpress.rawSql = sqlExpress.rawSql.replace(/\r?\n|\r/g, '');
    // we need to cache this function so that it doesn't get recreated on every render
    const onContextClose = (() => {
        console.log("clear cached sql, set empty.");
        this.cachedSql = [];
      });

    return SimpleLogContextUi(
      {
        sqlDataSource: this,
        row,
        orignQuery: sqlExpress,
        cachedSql: this.cachedSql,
        range: undefined,
        onContextClose,
        runContextQuery,
      }
    );
  }

  abstract getDB(dsID?: number): DB;

  abstract getQueryModel(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): SqlQueryModel;

  getResponseParser() {
    return this.responseParser;
  }

  interpolateVariable = (value: string | string[] | number, variable: VariableWithMultiSupport) => {
    if (typeof value === 'string') {
      if (variable.multi || variable.includeAll) {
        return this.getQueryModel().quoteLiteral(value); // add quotes `'`
      } else {
        // fixbug, the value will doesn't contains quotes `'` when checkbox of Multi value is not checked.
        // Another the type of variable is scopeVar, has same promblem.
        // Wrong Example:
        //  select * from table where name in ($var_a) => select * from table where name in (a)
        if (value === "''") {// PR: https://github.com/grafana/grafana/pull/56879
          return String(value).replace(/'/g, "''");
        } else {
          return value
        }
      }
    }

    if (typeof value === 'number') {
      return value;
    }

    if (Array.isArray(value)) {
      const quotedValues = value.filter((v) => v !== null && v !== undefined)
              .map((v) => this.getQueryModel().quoteLiteral(v));
      return quotedValues.join(',');
    }

    return value;
  };

  interpolateVariablesInQueries(queries: SQLQuery[], scopedVars: ScopedVars): SQLQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map((query) => {
        const expandedQuery = {
          ...query,
          datasource: this.getRef(),
          rawSql: this.templateSrv.replace(query.rawSql, scopedVars, this.interpolateVariable),
          rawQuery: true,
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  filterQuery(query: SQLQuery): boolean {
    return !query.hide;
  }

  applyTemplateVariables(target: SQLQuery, scopedVars: ScopedVars) {
    // delete a quotes `'`, e.g.
    // select * from table where a = ''aaa'' => select * from table where a = 'aaa'
    let sql = this.templateSrv.replace(target.rawSql, scopedVars, this.interpolateVariable);
    sql = sql.replace(/(?<!')''(.*?)''(?!')/g, "'$1'");
    return {
      refId: target.refId,
      datasource: this.getRef(),
      rawSql: sql,
      format: target.format,
    };
  }

  query(request: DataQueryRequest<SQLQuery>): Observable<DataQueryResponse> {
    // This logic reenables the previous SQL behavior regarding what databases are available for the user to query.
    if (isSqlDatasourceDatabaseSelectionFeatureFlagEnabled()) {
      const databaseIssue = this.checkForDatabaseIssue(request);

      if (!!databaseIssue) {
        const error = new Error(databaseIssue);
        return throwError(() => error);
      }
    }

    request.targets.forEach((target) => {
      if (request.app === CoreApp.Dashboard || request.app === CoreApp.PanelViewer) {
        return;
      }

      reportInteraction('grafana_sql_query_executed', {
        datasource: target.datasource?.type,
        editorMode: target.editorMode,
        format: target.format,
        app: request.app,
      });
    });

    return super.query(request);
  }

  private checkForDatabaseIssue(request: DataQueryRequest<SQLQuery>) {
    // If the datasource is Postgres and there is no default database configured - either never configured or removed - return a database issue.
    if (this.type === 'postgres' && !this.preconfiguredDatabase) {
      return `You do not currently have a default database configured for this data source. Postgres requires a default
             database with which to connect. Please configure one through the Data Sources Configuration page, or if you
             are using a provisioning file, update that configuration file with a default database.`;
    }

    // No need to check for database change/update issues if the datasource is being used in Explore.
    if (request.app !== CoreApp.Explore) {
      /*
        If a preconfigured datasource database has been added/updated - and the user has built ANY number of queries using a
        database OTHER than the preconfigured one, return a database issue - since those databases are no longer available.
        The user will need to update their queries to use the preconfigured database.
      */
      if (!!this.preconfiguredDatabase) {
        for (const target of request.targets) {
          // Test for database configuration change only if query was made in `builder` mode.
          if (target.editorMode === EditorMode.Builder && target.dataset !== this.preconfiguredDatabase) {
            return `The configuration for this panel's data source has been modified. The previous database used in this panel's
                   saved query is no longer available. Please update the query to use the new database option.
                   Previous query parameters will be preserved until the query is updated.`;
          }
        }
      }
    }

    return;
  }

  async metricFindQuery(query: string, options?: LegacyMetricFindQueryOptions): Promise<MetricFindValue[]> {
    const range = options?.range;
    if (range == null) {
      // i cannot create a scenario where this happens, we handle it just to be sure.
      return [];
    }

    let refId = 'tempvar';
    if (options && options.variable && options.variable.name) {
      refId = options.variable.name;
    }

    const scopedVars = {
      ...options?.scopedVars,
      ...getSearchFilterScopedVar({ query, wildcardChar: '%', options }),
    };

    const rawSql = this.templateSrv.replace(query, scopedVars, this.interpolateVariable);

    const interpolatedQuery: SQLQuery = {
      refId: refId,
      datasource: this.getRef(),
      rawSql,
      format: QueryFormat.Table,
    };

    // NOTE: we can remove this try-catch when https://github.com/grafana/grafana/issues/82250
    // is fixed.
    let response;
    try {
      response = await this.runMetaQuery(interpolatedQuery, range);
    } catch (error) {
      console.error(error);
      throw new Error('error when executing the sql query');
    }
    return this.getResponseParser().transformMetricFindResponse(response);
  }

  // NOTE: this always runs with the `@grafana/data/getDefaultTimeRange` time range
  async runSql<T extends object>(query: string, options?: RunSQLOptions) {
    const range = getDefaultTimeRange();
    const frame = await this.runMetaQuery({ rawSql: query, format: QueryFormat.Table, refId: options?.refId }, range);
    return new DataFrameView<T>(frame);
  }

  private runMetaQuery(request: Partial<SQLQuery>, range: TimeRange): Promise<DataFrame> {
    const refId = request.refId || 'meta';
    const queries: DataQuery[] = [{ ...request, datasource: request.datasource || this.getRef(), refId }];

    return lastValueFrom(
      getBackendSrv()
        .fetch<BackendDataSourceResponse>({
          url: '/api/ds/query',
          method: 'POST',
          headers: this.getRequestHeaders(),
          data: {
            from: range.from.valueOf().toString(),
            to: range.to.valueOf().toString(),
            queries,
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

  targetContainsTemplate(target: SQLQuery) {
    let queryWithoutMacros = target.rawSql;
    MACRO_NAMES.forEach((value) => {
      queryWithoutMacros = queryWithoutMacros?.replace(value, '') || '';
    });
    return this.templateSrv.containsTemplate(queryWithoutMacros);
  }
}

interface RunSQLOptions extends LegacyMetricFindQueryOptions {
  refId?: string;
}
