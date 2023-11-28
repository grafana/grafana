import { merge, of, Subject, throwError } from 'rxjs';
import { catchError, filter, finalize, mergeMap, take, takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { CoreApp, getDefaultTimeRange, LoadingState, } from '@grafana/data';
import { dispatch, getState } from '../../../store/store';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { runRequest } from '../../query/state/runRequest';
import { getLastKey, getVariable } from '../state/selectors';
import { VariableRefresh } from '../types';
import { getTemplatedRegex } from '../utils';
import { toMetricFindValuesOperator, updateOptionsState, validateVariableSelection } from './operators';
import { QueryRunners } from './queryRunners';
export class VariableQueryRunner {
    constructor(dependencies = {
        dispatch,
        getState,
        getVariable,
        getTemplatedRegex,
        getTimeSrv,
        queryRunners: new QueryRunners(),
        runRequest,
    }) {
        this.dependencies = dependencies;
        this.updateOptionsRequests = new Subject();
        this.updateOptionsResults = new Subject();
        this.cancelRequests = new Subject();
        this.onNewRequest = this.onNewRequest.bind(this);
        this.subscription = this.updateOptionsRequests.subscribe(this.onNewRequest);
    }
    queueRequest(args) {
        this.updateOptionsRequests.next(args);
    }
    getResponse(identifier) {
        return this.updateOptionsResults.asObservable().pipe(filter((result) => result.identifier === identifier));
    }
    cancelRequest(identifier) {
        this.cancelRequests.next({ identifier });
    }
    destroy() {
        this.subscription.unsubscribe();
    }
    onNewRequest(args) {
        const { datasource, identifier, searchFilter } = args;
        try {
            const { dispatch, runRequest, getTemplatedRegex: getTemplatedRegexFunc, getVariable, queryRunners, getTimeSrv, getState, } = this.dependencies;
            const beforeKey = getLastKey(getState());
            this.updateOptionsResults.next({ identifier, state: LoadingState.Loading });
            const variable = getVariable(identifier, getState());
            if (variable.type !== 'query') {
                return;
            }
            const timeSrv = getTimeSrv();
            const runnerArgs = { variable, datasource, searchFilter, timeSrv, runRequest };
            const runner = queryRunners.getRunnerForDatasource(datasource);
            const target = runner.getTarget({ datasource, variable });
            const request = this.getRequest(variable, args, target);
            runner
                .runRequest(runnerArgs, request)
                .pipe(filter(() => {
                // Lets check if we started another batch during the execution of the observable. If so we just want to abort the rest.
                const afterKey = getLastKey(getState());
                return beforeKey === afterKey;
            }), filter((data) => data.state === LoadingState.Done || data.state === LoadingState.Error), // we only care about done or error for now
            take(1), // take the first result, using first caused a bug where it in some situations throw an uncaught error because of no results had been received yet
            mergeMap((data) => {
                if (data.state === LoadingState.Error) {
                    return throwError(() => data.error);
                }
                return of(data);
            }), toMetricFindValuesOperator(), updateOptionsState({ variable, dispatch, getTemplatedRegexFunc }), validateVariableSelection({ variable, dispatch, searchFilter }), takeUntil(merge(this.updateOptionsRequests, this.cancelRequests).pipe(filter((args) => {
                let cancelRequest = false;
                if (args.identifier.id === identifier.id) {
                    cancelRequest = true;
                    this.updateOptionsResults.next({ identifier, state: LoadingState.Loading, cancelled: cancelRequest });
                }
                return cancelRequest;
            }))), catchError((error) => {
                if (error.cancelled) {
                    return of({});
                }
                this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
                return throwError(() => error);
            }), finalize(() => {
                this.updateOptionsResults.next({ identifier, state: LoadingState.Done });
            }))
                .subscribe();
        }
        catch (error) {
            this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
        }
    }
    getRequest(variable, args, target) {
        const { searchFilter } = args;
        const variableAsVars = { variable: { text: variable.current.text, value: variable.current.value } };
        const searchFilterScope = { searchFilter: { text: searchFilter, value: searchFilter } };
        const searchFilterAsVars = searchFilter ? searchFilterScope : {};
        const scopedVars = Object.assign(Object.assign({}, searchFilterAsVars), variableAsVars);
        const range = variable.refresh === VariableRefresh.onTimeRangeChanged
            ? this.dependencies.getTimeSrv().timeRange()
            : getDefaultTimeRange();
        const request = {
            app: CoreApp.Dashboard,
            requestId: uuidv4(),
            timezone: '',
            range,
            interval: '',
            intervalMs: 0,
            targets: [target],
            scopedVars,
            startTime: Date.now(),
        };
        return request;
    }
}
let singleton;
export function setVariableQueryRunner(runner) {
    singleton = runner;
}
export function getVariableQueryRunner() {
    return singleton;
}
//# sourceMappingURL=VariableQueryRunner.js.map