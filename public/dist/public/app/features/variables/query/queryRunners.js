import { from, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { getDefaultTimeRange, LoadingState, VariableSupportType, } from '@grafana/data';
import { hasCustomVariableSupport, hasDatasourceVariableSupport, hasLegacyVariableSupport, hasStandardVariableSupport, } from '../guard';
import { getLegacyQueryOptions } from '../utils';
export class QueryRunners {
    constructor() {
        this.runners = [
            new LegacyQueryRunner(),
            new StandardQueryRunner(),
            new CustomQueryRunner(),
            new DatasourceQueryRunner(),
        ];
    }
    getRunnerForDatasource(datasource) {
        const runner = this.runners.find((runner) => runner.canRun(datasource));
        if (runner) {
            return runner;
        }
        throw new Error("Couldn't find a query runner that matches supplied arguments.");
    }
}
class LegacyQueryRunner {
    constructor() {
        this.type = VariableSupportType.Legacy;
    }
    canRun(dataSource) {
        return hasLegacyVariableSupport(dataSource);
    }
    getTarget({ datasource, variable }) {
        if (hasLegacyVariableSupport(datasource)) {
            return variable.query;
        }
        throw new Error("Couldn't create a target with supplied arguments.");
    }
    runRequest({ datasource, variable, searchFilter, timeSrv }, request) {
        if (!hasLegacyVariableSupport(datasource)) {
            return getEmptyMetricFindValueObservable();
        }
        const queryOptions = getLegacyQueryOptions(variable, searchFilter, timeSrv, request.scopedVars);
        return from(datasource.metricFindQuery(variable.query, queryOptions)).pipe(mergeMap((values) => {
            if (!values || !values.length) {
                return getEmptyMetricFindValueObservable();
            }
            const series = values;
            return of({ series, state: LoadingState.Done, timeRange: queryOptions.range });
        }));
    }
}
class StandardQueryRunner {
    constructor() {
        this.type = VariableSupportType.Standard;
    }
    canRun(dataSource) {
        return hasStandardVariableSupport(dataSource);
    }
    getTarget({ datasource, variable }) {
        if (hasStandardVariableSupport(datasource)) {
            return datasource.variables.toDataQuery(variable.query);
        }
        throw new Error("Couldn't create a target with supplied arguments.");
    }
    runRequest({ datasource, runRequest }, request) {
        if (!hasStandardVariableSupport(datasource)) {
            return getEmptyMetricFindValueObservable();
        }
        if (!datasource.variables.query) {
            return runRequest(datasource, request);
        }
        return runRequest(datasource, request, datasource.variables.query.bind(datasource.variables));
    }
}
class CustomQueryRunner {
    constructor() {
        this.type = VariableSupportType.Custom;
    }
    canRun(dataSource) {
        return hasCustomVariableSupport(dataSource);
    }
    getTarget({ datasource, variable }) {
        if (hasCustomVariableSupport(datasource)) {
            return variable.query;
        }
        throw new Error("Couldn't create a target with supplied arguments.");
    }
    runRequest({ datasource, runRequest }, request) {
        if (!hasCustomVariableSupport(datasource)) {
            return getEmptyMetricFindValueObservable();
        }
        return runRequest(datasource, request, datasource.variables.query.bind(datasource.variables));
    }
}
export const variableDummyRefId = 'variable-query';
class DatasourceQueryRunner {
    constructor() {
        this.type = VariableSupportType.Datasource;
    }
    canRun(dataSource) {
        return hasDatasourceVariableSupport(dataSource);
    }
    getTarget({ datasource, variable }) {
        var _a;
        if (hasDatasourceVariableSupport(datasource)) {
            return Object.assign(Object.assign({}, variable.query), { refId: (_a = variable.query.refId) !== null && _a !== void 0 ? _a : variableDummyRefId });
        }
        throw new Error("Couldn't create a target with supplied arguments.");
    }
    runRequest({ datasource, runRequest }, request) {
        if (!hasDatasourceVariableSupport(datasource)) {
            return getEmptyMetricFindValueObservable();
        }
        return runRequest(datasource, request);
    }
}
function getEmptyMetricFindValueObservable() {
    return of({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
}
//# sourceMappingURL=queryRunners.js.map