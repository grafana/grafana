import { lastValueFrom, Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';

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
import { SqlQueryEditorLazy } from '../components/QueryEditorLazy';
import { MACRO_NAMES } from '../constants';
import { DB, SQLQuery, SQLOptions, SqlQueryModel, QueryFormat } from '../types';
import migrateAnnotation from '../utils/migration';

import { isSqlDatasourceDatabaseSelectionFeatureFlagEnabled } from './../components/QueryEditorFeatureFlag.utils';

export abstract class SqlDatasource extends DataSourceWithBackend<SQLQuery, SQLOptions> {
  id: number;
  responseParser: ResponseParser;
  name: string;
  interval: string;
  db: DB;
  preconfiguredDatabase: string;

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
    /*
      The `settingsData.database` will be defined if a default database has been defined in either
      1) the ConfigurationEditor.tsx, OR 2) the provisioning config file, either under `jsondata.database`, or simply `database`.
    */
    this.preconfiguredDatabase = settingsData.database ?? '';
    this.annotations = {
      prepareAnnotation: migrateAnnotation,
      QueryEditor: SqlQueryEditorLazy,
    };
  }

  abstract getDB(dsID?: number): DB;

  abstract getQueryModel(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): SqlQueryModel;

  getResponseParser() {
    return this.responseParser;
  }

  interpolateVariable = (value: string | string[] | number, variable: VariableWithMultiSupport) => {
    if (typeof value === 'string') {
      if (variable.multi || variable.includeAll) {
        return this.getQueryModel().quoteLiteral(value);
      } else {
        return String(value).replace(/'/g, "''");
      }
    }

    if (typeof value === 'number') {
      return value;
    }

    if (Array.isArray(value)) {
      const quotedValues = value.map((v) => this.getQueryModel().quoteLiteral(v));
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
    return {
      refId: target.refId,
      datasource: this.getRef(),
      rawSql: this.templateSrv.replace(target.rawSql, scopedVars, this.interpolateVariable),
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
