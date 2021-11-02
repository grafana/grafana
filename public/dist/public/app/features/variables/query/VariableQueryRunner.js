import { __assign } from "tslib";
import { merge, of, Subject, throwError } from 'rxjs';
import { catchError, filter, finalize, first, mergeMap, takeUntil } from 'rxjs/operators';
import { CoreApp, getDefaultTimeRange, LoadingState, } from '@grafana/data';
import { getVariable } from '../state/selectors';
import { VariableRefresh } from '../types';
import { dispatch, getState } from '../../../store/store';
import { getTemplatedRegex } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { QueryRunners } from './queryRunners';
import { runRequest } from '../../query/state/runRequest';
import { toMetricFindValues, updateOptionsState, validateVariableSelection } from './operators';
var VariableQueryRunner = /** @class */ (function () {
    function VariableQueryRunner(dependencies) {
        if (dependencies === void 0) { dependencies = {
            dispatch: dispatch,
            getState: getState,
            getVariable: getVariable,
            getTemplatedRegex: getTemplatedRegex,
            getTimeSrv: getTimeSrv,
            queryRunners: new QueryRunners(),
            runRequest: runRequest,
        }; }
        this.dependencies = dependencies;
        this.updateOptionsRequests = new Subject();
        this.updateOptionsResults = new Subject();
        this.cancelRequests = new Subject();
        this.onNewRequest = this.onNewRequest.bind(this);
        this.subscription = this.updateOptionsRequests.subscribe(this.onNewRequest);
    }
    VariableQueryRunner.prototype.queueRequest = function (args) {
        this.updateOptionsRequests.next(args);
    };
    VariableQueryRunner.prototype.getResponse = function (identifier) {
        return this.updateOptionsResults.asObservable().pipe(filter(function (result) { return result.identifier === identifier; }));
    };
    VariableQueryRunner.prototype.cancelRequest = function (identifier) {
        this.cancelRequests.next({ identifier: identifier });
    };
    VariableQueryRunner.prototype.destroy = function () {
        this.subscription.unsubscribe();
    };
    VariableQueryRunner.prototype.onNewRequest = function (args) {
        var _this = this;
        var datasource = args.datasource, identifier = args.identifier, searchFilter = args.searchFilter;
        try {
            var _a = this.dependencies, dispatch_1 = _a.dispatch, runRequest_1 = _a.runRequest, getTemplatedRegexFunc = _a.getTemplatedRegex, getVariable_1 = _a.getVariable, queryRunners = _a.queryRunners, getTimeSrv_1 = _a.getTimeSrv, getState_1 = _a.getState;
            var beforeUid_1 = getState_1().templating.transaction.uid;
            this.updateOptionsResults.next({ identifier: identifier, state: LoadingState.Loading });
            var variable = getVariable_1(identifier.id, getState_1());
            var timeSrv = getTimeSrv_1();
            var runnerArgs = { variable: variable, datasource: datasource, searchFilter: searchFilter, timeSrv: timeSrv, runRequest: runRequest_1 };
            var runner = queryRunners.getRunnerForDatasource(datasource);
            var target = runner.getTarget({ datasource: datasource, variable: variable });
            var request = this.getRequest(variable, args, target);
            runner
                .runRequest(runnerArgs, request)
                .pipe(filter(function () {
                // Lets check if we started another batch during the execution of the observable. If so we just want to abort the rest.
                var afterUid = getState_1().templating.transaction.uid;
                return beforeUid_1 === afterUid;
            }), first(function (data) { return data.state === LoadingState.Done || data.state === LoadingState.Error; }), mergeMap(function (data) {
                if (data.state === LoadingState.Error) {
                    return throwError(data.error);
                }
                return of(data);
            }), toMetricFindValues(), updateOptionsState({ variable: variable, dispatch: dispatch_1, getTemplatedRegexFunc: getTemplatedRegexFunc }), validateVariableSelection({ variable: variable, dispatch: dispatch_1, searchFilter: searchFilter }), takeUntil(merge(this.updateOptionsRequests, this.cancelRequests).pipe(filter(function (args) {
                var cancelRequest = false;
                if (args.identifier.id === identifier.id) {
                    cancelRequest = true;
                    _this.updateOptionsResults.next({ identifier: identifier, state: LoadingState.Loading, cancelled: cancelRequest });
                }
                return cancelRequest;
            }))), catchError(function (error) {
                if (error.cancelled) {
                    return of({});
                }
                _this.updateOptionsResults.next({ identifier: identifier, state: LoadingState.Error, error: error });
                return throwError(error);
            }), finalize(function () {
                _this.updateOptionsResults.next({ identifier: identifier, state: LoadingState.Done });
            }))
                .subscribe();
        }
        catch (error) {
            this.updateOptionsResults.next({ identifier: identifier, state: LoadingState.Error, error: error });
        }
    };
    VariableQueryRunner.prototype.getRequest = function (variable, args, target) {
        var searchFilter = args.searchFilter;
        var variableAsVars = { variable: { text: variable.current.text, value: variable.current.value } };
        var searchFilterScope = { searchFilter: { text: searchFilter, value: searchFilter } };
        var searchFilterAsVars = searchFilter ? searchFilterScope : {};
        var scopedVars = __assign(__assign({}, searchFilterAsVars), variableAsVars);
        var range = variable.refresh === VariableRefresh.onTimeRangeChanged
            ? this.dependencies.getTimeSrv().timeRange()
            : getDefaultTimeRange();
        var request = {
            app: CoreApp.Dashboard,
            requestId: uuidv4(),
            timezone: '',
            range: range,
            interval: '',
            intervalMs: 0,
            targets: [target],
            scopedVars: scopedVars,
            startTime: Date.now(),
        };
        return request;
    };
    return VariableQueryRunner;
}());
export { VariableQueryRunner };
var singleton;
export function setVariableQueryRunner(runner) {
    singleton = runner;
}
export function getVariableQueryRunner() {
    return singleton;
}
//# sourceMappingURL=VariableQueryRunner.js.map