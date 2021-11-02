import { __assign, __extends } from "tslib";
import { DataSourceApi, LoadingState, } from '@grafana/data';
import { getDataSourceSrv, toDataQueryError } from '@grafana/runtime';
import { cloneDeep, groupBy } from 'lodash';
import { forkJoin, from, of } from 'rxjs';
import { catchError, map, mergeAll, mergeMap, reduce, toArray } from 'rxjs/operators';
export var MIXED_DATASOURCE_NAME = '-- Mixed --';
var MixedDatasource = /** @class */ (function (_super) {
    __extends(MixedDatasource, _super);
    function MixedDatasource(instanceSettings) {
        return _super.call(this, instanceSettings) || this;
    }
    MixedDatasource.prototype.query = function (request) {
        // Remove any invalid queries
        var queries = request.targets.filter(function (t) {
            var _a;
            return ((_a = t.datasource) === null || _a === void 0 ? void 0 : _a.type) !== MIXED_DATASOURCE_NAME;
        });
        if (!queries.length) {
            return of({ data: [] }); // nothing
        }
        // Build groups of queries to run in parallel
        var sets = groupBy(queries, 'datasource.uid');
        var mixed = [];
        for (var key in sets) {
            var targets = sets[key];
            mixed.push({
                datasource: getDataSourceSrv().get(targets[0].datasource, request.scopedVars),
                targets: targets,
            });
        }
        // Missing UIDs?
        if (!mixed.length) {
            return of({ data: [] }); // nothing
        }
        return this.batchQueries(mixed, request);
    };
    MixedDatasource.prototype.batchQueries = function (mixed, request) {
        var runningQueries = mixed.filter(this.isQueryable).map(function (query, i) {
            return from(query.datasource).pipe(mergeMap(function (api) {
                var dsRequest = cloneDeep(request);
                dsRequest.requestId = "mixed-" + i + "-" + (dsRequest.requestId || '');
                dsRequest.targets = query.targets;
                return from(api.query(dsRequest)).pipe(map(function (response) {
                    return __assign(__assign({}, response), { data: response.data || [], state: LoadingState.Loading, key: "mixed-" + i + "-" + (response.key || '') });
                }), toArray(), catchError(function (err) {
                    err = toDataQueryError(err);
                    err.message = api.name + ": " + err.message;
                    return of([
                        {
                            data: [],
                            state: LoadingState.Error,
                            error: err,
                            key: "mixed-" + i + "-" + (dsRequest.requestId || ''),
                        },
                    ]);
                }));
            }));
        });
        return forkJoin(runningQueries).pipe(flattenResponses(), map(this.finalizeResponses), mergeAll());
    };
    MixedDatasource.prototype.testDatasource = function () {
        return Promise.resolve({});
    };
    MixedDatasource.prototype.isQueryable = function (query) {
        return query && Array.isArray(query.targets) && query.targets.length > 0;
    };
    MixedDatasource.prototype.finalizeResponses = function (responses) {
        var length = responses.length;
        if (length === 0) {
            return responses;
        }
        var error = responses.find(function (response) { return response.state === LoadingState.Error; });
        if (error) {
            responses.push(error); // adds the first found error entry so error shows up in the panel
        }
        else {
            responses[length - 1].state = LoadingState.Done;
        }
        return responses;
    };
    return MixedDatasource;
}(DataSourceApi));
export { MixedDatasource };
function flattenResponses() {
    return reduce(function (all, current) {
        return current.reduce(function (innerAll, innerCurrent) {
            innerAll.push.apply(innerAll, innerCurrent);
            return innerAll;
        }, all);
    }, []);
}
//# sourceMappingURL=MixedDataSource.js.map