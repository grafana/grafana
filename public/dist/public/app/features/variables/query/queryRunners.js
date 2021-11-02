import { __assign } from "tslib";
import { from, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { getDefaultTimeRange, LoadingState, VariableSupportType, } from '@grafana/data';
import { hasCustomVariableSupport, hasDatasourceVariableSupport, hasLegacyVariableSupport, hasStandardVariableSupport, } from '../guard';
import { getLegacyQueryOptions } from '../utils';
var QueryRunners = /** @class */ (function () {
    function QueryRunners() {
        this.runners = [
            new LegacyQueryRunner(),
            new StandardQueryRunner(),
            new CustomQueryRunner(),
            new DatasourceQueryRunner(),
        ];
    }
    QueryRunners.prototype.getRunnerForDatasource = function (datasource) {
        var runner = this.runners.find(function (runner) { return runner.canRun(datasource); });
        if (runner) {
            return runner;
        }
        throw new Error("Couldn't find a query runner that matches supplied arguments.");
    };
    return QueryRunners;
}());
export { QueryRunners };
var LegacyQueryRunner = /** @class */ (function () {
    function LegacyQueryRunner() {
        this.type = VariableSupportType.Legacy;
    }
    LegacyQueryRunner.prototype.canRun = function (dataSource) {
        return hasLegacyVariableSupport(dataSource);
    };
    LegacyQueryRunner.prototype.getTarget = function (_a) {
        var datasource = _a.datasource, variable = _a.variable;
        if (hasLegacyVariableSupport(datasource)) {
            return variable.query;
        }
        throw new Error("Couldn't create a target with supplied arguments.");
    };
    LegacyQueryRunner.prototype.runRequest = function (_a, request) {
        var datasource = _a.datasource, variable = _a.variable, searchFilter = _a.searchFilter, timeSrv = _a.timeSrv;
        if (!hasLegacyVariableSupport(datasource)) {
            return getEmptyMetricFindValueObservable();
        }
        var queryOptions = getLegacyQueryOptions(variable, searchFilter, timeSrv);
        return from(datasource.metricFindQuery(variable.query, queryOptions)).pipe(mergeMap(function (values) {
            if (!values || !values.length) {
                return getEmptyMetricFindValueObservable();
            }
            var series = values;
            return of({ series: series, state: LoadingState.Done, timeRange: queryOptions.range });
        }));
    };
    return LegacyQueryRunner;
}());
var StandardQueryRunner = /** @class */ (function () {
    function StandardQueryRunner() {
        this.type = VariableSupportType.Standard;
    }
    StandardQueryRunner.prototype.canRun = function (dataSource) {
        return hasStandardVariableSupport(dataSource);
    };
    StandardQueryRunner.prototype.getTarget = function (_a) {
        var datasource = _a.datasource, variable = _a.variable;
        if (hasStandardVariableSupport(datasource)) {
            return datasource.variables.toDataQuery(variable.query);
        }
        throw new Error("Couldn't create a target with supplied arguments.");
    };
    StandardQueryRunner.prototype.runRequest = function (_a, request) {
        var datasource = _a.datasource, runRequest = _a.runRequest;
        if (!hasStandardVariableSupport(datasource)) {
            return getEmptyMetricFindValueObservable();
        }
        if (!datasource.variables.query) {
            return runRequest(datasource, request);
        }
        return runRequest(datasource, request, datasource.variables.query);
    };
    return StandardQueryRunner;
}());
var CustomQueryRunner = /** @class */ (function () {
    function CustomQueryRunner() {
        this.type = VariableSupportType.Custom;
    }
    CustomQueryRunner.prototype.canRun = function (dataSource) {
        return hasCustomVariableSupport(dataSource);
    };
    CustomQueryRunner.prototype.getTarget = function (_a) {
        var datasource = _a.datasource, variable = _a.variable;
        if (hasCustomVariableSupport(datasource)) {
            return variable.query;
        }
        throw new Error("Couldn't create a target with supplied arguments.");
    };
    CustomQueryRunner.prototype.runRequest = function (_a, request) {
        var datasource = _a.datasource, runRequest = _a.runRequest;
        if (!hasCustomVariableSupport(datasource)) {
            return getEmptyMetricFindValueObservable();
        }
        return runRequest(datasource, request, datasource.variables.query);
    };
    return CustomQueryRunner;
}());
export var variableDummyRefId = 'variable-query';
var DatasourceQueryRunner = /** @class */ (function () {
    function DatasourceQueryRunner() {
        this.type = VariableSupportType.Datasource;
    }
    DatasourceQueryRunner.prototype.canRun = function (dataSource) {
        return hasDatasourceVariableSupport(dataSource);
    };
    DatasourceQueryRunner.prototype.getTarget = function (_a) {
        var _b;
        var datasource = _a.datasource, variable = _a.variable;
        if (hasDatasourceVariableSupport(datasource)) {
            return __assign(__assign({}, variable.query), { refId: (_b = variable.query.refId) !== null && _b !== void 0 ? _b : variableDummyRefId });
        }
        throw new Error("Couldn't create a target with supplied arguments.");
    };
    DatasourceQueryRunner.prototype.runRequest = function (_a, request) {
        var datasource = _a.datasource, runRequest = _a.runRequest;
        if (!hasDatasourceVariableSupport(datasource)) {
            return getEmptyMetricFindValueObservable();
        }
        return runRequest(datasource, request);
    };
    return DatasourceQueryRunner;
}());
function getEmptyMetricFindValueObservable() {
    return of({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
}
//# sourceMappingURL=queryRunners.js.map