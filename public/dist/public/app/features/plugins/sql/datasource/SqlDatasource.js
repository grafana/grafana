import { __awaiter } from "tslib";
import { lastValueFrom, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { getDefaultTimeRange, DataFrameView, CoreApp, getSearchFilterScopedVar, } from '@grafana/data';
import { EditorMode } from '@grafana/experimental';
import { DataSourceWithBackend, getBackendSrv, getTemplateSrv, toDataQueryResponse, reportInteraction, } from '@grafana/runtime';
import { ResponseParser } from '../ResponseParser';
import { SqlQueryEditor } from '../components/QueryEditor';
import { MACRO_NAMES } from '../constants';
import { QueryFormat } from '../types';
import migrateAnnotation from '../utils/migration';
import { isSqlDatasourceDatabaseSelectionFeatureFlagEnabled } from './../components/QueryEditorFeatureFlag.utils';
export class SqlDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        var _a;
        super(instanceSettings);
        this.templateSrv = templateSrv;
        this.interpolateVariable = (value, variable) => {
            if (typeof value === 'string') {
                if (variable.multi || variable.includeAll) {
                    return this.getQueryModel().quoteLiteral(value);
                }
                else {
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
        this.preconfiguredDatabase = (_a = settingsData.database) !== null && _a !== void 0 ? _a : '';
        this.annotations = {
            prepareAnnotation: migrateAnnotation,
            QueryEditor: SqlQueryEditor,
        };
    }
    getResponseParser() {
        return this.responseParser;
    }
    interpolateVariablesInQueries(queries, scopedVars) {
        let expandedQueries = queries;
        if (queries && queries.length > 0) {
            expandedQueries = queries.map((query) => {
                const expandedQuery = Object.assign(Object.assign({}, query), { datasource: this.getRef(), rawSql: this.templateSrv.replace(query.rawSql, scopedVars, this.interpolateVariable), rawQuery: true });
                return expandedQuery;
            });
        }
        return expandedQueries;
    }
    filterQuery(query) {
        return !query.hide;
    }
    applyTemplateVariables(target, scopedVars) {
        return {
            refId: target.refId,
            datasource: this.getRef(),
            rawSql: this.templateSrv.replace(target.rawSql, scopedVars, this.interpolateVariable),
            format: target.format,
        };
    }
    query(request) {
        // This logic reenables the previous SQL behavior regarding what databases are available for the user to query.
        if (isSqlDatasourceDatabaseSelectionFeatureFlagEnabled()) {
            const databaseIssue = this.checkForDatabaseIssue(request);
            if (!!databaseIssue) {
                const error = new Error(databaseIssue);
                return throwError(() => error);
            }
        }
        request.targets.forEach((target) => {
            var _a;
            if (request.app === CoreApp.Dashboard || request.app === CoreApp.PanelViewer) {
                return;
            }
            reportInteraction('grafana_sql_query_executed', {
                datasource: (_a = target.datasource) === null || _a === void 0 ? void 0 : _a.type,
                editorMode: target.editorMode,
                format: target.format,
                app: request.app,
            });
        });
        return super.query(request);
    }
    checkForDatabaseIssue(request) {
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
    metricFindQuery(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const range = options === null || options === void 0 ? void 0 : options.range;
            if (range == null) {
                // i cannot create a scenario where this happens, we handle it just to be sure.
                return [];
            }
            let refId = 'tempvar';
            if (options && options.variable && options.variable.name) {
                refId = options.variable.name;
            }
            const scopedVars = Object.assign(Object.assign({}, options === null || options === void 0 ? void 0 : options.scopedVars), getSearchFilterScopedVar({ query, wildcardChar: '%', options }));
            const rawSql = this.templateSrv.replace(query, scopedVars, this.interpolateVariable);
            const interpolatedQuery = {
                refId: refId,
                datasource: this.getRef(),
                rawSql,
                format: QueryFormat.Table,
            };
            const response = yield this.runMetaQuery(interpolatedQuery, range);
            return this.getResponseParser().transformMetricFindResponse(response);
        });
    }
    // NOTE: this always runs with the `@grafana/data/getDefaultTimeRange` time range
    runSql(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const range = getDefaultTimeRange();
            const frame = yield this.runMetaQuery({ rawSql: query, format: QueryFormat.Table, refId: options === null || options === void 0 ? void 0 : options.refId }, range);
            return new DataFrameView(frame);
        });
    }
    runMetaQuery(request, range) {
        const refId = request.refId || 'meta';
        const queries = [Object.assign(Object.assign({}, request), { datasource: request.datasource || this.getRef(), refId })];
        return lastValueFrom(getBackendSrv()
            .fetch({
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
            .pipe(map((res) => {
            var _a;
            const rsp = toDataQueryResponse(res, queries);
            return (_a = rsp.data[0]) !== null && _a !== void 0 ? _a : { fields: [] };
        })));
    }
    targetContainsTemplate(target) {
        let queryWithoutMacros = target.rawSql;
        MACRO_NAMES.forEach((value) => {
            queryWithoutMacros = (queryWithoutMacros === null || queryWithoutMacros === void 0 ? void 0 : queryWithoutMacros.replace(value, '')) || '';
        });
        return this.templateSrv.containsTemplate(queryWithoutMacros);
    }
}
//# sourceMappingURL=SqlDatasource.js.map