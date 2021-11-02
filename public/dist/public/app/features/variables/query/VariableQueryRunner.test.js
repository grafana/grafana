import { of, throwError } from 'rxjs';
import { getDefaultTimeRange, LoadingState, VariableSupportType } from '@grafana/data';
import { delay } from 'rxjs/operators';
import { VariableQueryRunner } from './VariableQueryRunner';
import { queryBuilder } from '../shared/testing/builders';
import { toVariableIdentifier } from '../state/types';
import { updateVariableOptions } from './reducer';
function expectOnResults(args) {
    var runner = args.runner, identifier = args.identifier, done = args.done, expectCallback = args.expect;
    var results = [];
    var subscription = runner.getResponse(identifier).subscribe({
        next: function (value) {
            results.push(value);
            if (value.state === LoadingState.Done || value.state === LoadingState.Error) {
                try {
                    expectCallback(results);
                    subscription.unsubscribe();
                    done();
                }
                catch (err) {
                    subscription.unsubscribe();
                    done.fail(err);
                }
            }
        },
    });
}
function getTestContext(variable) {
    var _a;
    variable = variable !== null && variable !== void 0 ? variable : queryBuilder().withId('query').build();
    var getTimeSrv = jest.fn().mockReturnValue({
        timeRange: jest.fn().mockReturnValue(getDefaultTimeRange()),
    });
    var datasource = { metricFindQuery: jest.fn().mockResolvedValue([]) };
    var identifier = toVariableIdentifier(variable);
    var searchFilter = undefined;
    var getTemplatedRegex = jest.fn().mockReturnValue('getTemplatedRegex result');
    var dispatch = jest.fn().mockResolvedValue({});
    var getState = jest.fn().mockReturnValue({
        templating: {
            transaction: {
                uid: '0123456789',
            },
        },
        variables: (_a = {},
            _a[variable.id] = variable,
            _a),
    });
    var queryRunner = {
        type: VariableSupportType.Standard,
        canRun: jest.fn().mockReturnValue(true),
        getTarget: jest.fn().mockReturnValue({ refId: 'A', query: 'A query' }),
        runRequest: jest.fn().mockReturnValue(of({ series: [], state: LoadingState.Done })),
    };
    var queryRunners = {
        getRunnerForDatasource: jest.fn().mockReturnValue(queryRunner),
    };
    var getVariable = jest.fn().mockReturnValue(variable);
    var runRequest = jest.fn().mockReturnValue(of({}));
    var runner = new VariableQueryRunner({
        getTimeSrv: getTimeSrv,
        getTemplatedRegex: getTemplatedRegex,
        dispatch: dispatch,
        getState: getState,
        getVariable: getVariable,
        queryRunners: queryRunners,
        runRequest: runRequest,
    });
    return {
        identifier: identifier,
        datasource: datasource,
        runner: runner,
        searchFilter: searchFilter,
        getTemplatedRegex: getTemplatedRegex,
        dispatch: dispatch,
        getState: getState,
        queryRunner: queryRunner,
        queryRunners: queryRunners,
        getVariable: getVariable,
        runRequest: runRequest,
        variable: variable,
        getTimeSrv: getTimeSrv,
    };
}
describe('VariableQueryRunner', function () {
    describe('happy case', function () {
        it('then it should work as expected', function (done) {
            var _a = getTestContext(), identifier = _a.identifier, runner = _a.runner, datasource = _a.datasource, getState = _a.getState, getVariable = _a.getVariable, queryRunners = _a.queryRunners, queryRunner = _a.queryRunner, dispatch = _a.dispatch;
            expectOnResults({
                identifier: identifier,
                runner: runner,
                expect: function (results) {
                    // verify that the observable works as expected
                    expect(results).toEqual([
                        { state: LoadingState.Loading, identifier: identifier },
                        { state: LoadingState.Done, identifier: identifier },
                    ]);
                    // verify that mocks have been called as expected
                    expect(getState).toHaveBeenCalledTimes(3);
                    expect(getVariable).toHaveBeenCalledTimes(1);
                    expect(queryRunners.getRunnerForDatasource).toHaveBeenCalledTimes(1);
                    expect(queryRunner.getTarget).toHaveBeenCalledTimes(1);
                    expect(queryRunner.runRequest).toHaveBeenCalledTimes(1);
                    expect(datasource.metricFindQuery).not.toHaveBeenCalled();
                    // updateVariableOptions and validateVariableSelectionState
                    expect(dispatch).toHaveBeenCalledTimes(2);
                    expect(dispatch.mock.calls[0][0]).toEqual(updateVariableOptions({
                        id: 'query',
                        type: 'query',
                        data: { results: [], templatedRegex: 'getTemplatedRegex result' },
                    }));
                },
                done: done,
            });
            runner.queueRequest({ identifier: identifier, datasource: datasource });
        });
    });
    describe('error cases', function () {
        describe('queryRunners.getRunnerForDatasource throws', function () {
            it('then it should work as expected', function (done) {
                var _a = getTestContext(), identifier = _a.identifier, runner = _a.runner, datasource = _a.datasource, getState = _a.getState, getVariable = _a.getVariable, queryRunners = _a.queryRunners, queryRunner = _a.queryRunner, dispatch = _a.dispatch;
                queryRunners.getRunnerForDatasource = jest.fn().mockImplementation(function () {
                    throw new Error('getRunnerForDatasource error');
                });
                expectOnResults({
                    identifier: identifier,
                    runner: runner,
                    expect: function (results) {
                        // verify that the observable works as expected
                        expect(results).toEqual([
                            { state: LoadingState.Loading, identifier: identifier },
                            { state: LoadingState.Error, identifier: identifier, error: new Error('getRunnerForDatasource error') },
                        ]);
                        // verify that mocks have been called as expected
                        expect(getState).toHaveBeenCalledTimes(2);
                        expect(getVariable).toHaveBeenCalledTimes(1);
                        expect(queryRunners.getRunnerForDatasource).toHaveBeenCalledTimes(1);
                        expect(queryRunner.getTarget).not.toHaveBeenCalled();
                        expect(queryRunner.runRequest).not.toHaveBeenCalled();
                        expect(datasource.metricFindQuery).not.toHaveBeenCalled();
                        expect(dispatch).not.toHaveBeenCalled();
                    },
                    done: done,
                });
                runner.queueRequest({ identifier: identifier, datasource: datasource });
            });
        });
        describe('runRequest throws', function () {
            it('then it should work as expected', function (done) {
                var _a = getTestContext(), identifier = _a.identifier, runner = _a.runner, datasource = _a.datasource, getState = _a.getState, getVariable = _a.getVariable, queryRunners = _a.queryRunners, queryRunner = _a.queryRunner, dispatch = _a.dispatch;
                queryRunner.runRequest = jest.fn().mockReturnValue(throwError(new Error('runRequest error')));
                expectOnResults({
                    identifier: identifier,
                    runner: runner,
                    expect: function (results) {
                        // verify that the observable works as expected
                        expect(results).toEqual([
                            { state: LoadingState.Loading, identifier: identifier },
                            { state: LoadingState.Error, identifier: identifier, error: new Error('runRequest error') },
                        ]);
                        // verify that mocks have been called as expected
                        expect(getState).toHaveBeenCalledTimes(2);
                        expect(getVariable).toHaveBeenCalledTimes(1);
                        expect(queryRunners.getRunnerForDatasource).toHaveBeenCalledTimes(1);
                        expect(queryRunner.getTarget).toHaveBeenCalledTimes(1);
                        expect(queryRunner.runRequest).toHaveBeenCalledTimes(1);
                        expect(datasource.metricFindQuery).not.toHaveBeenCalled();
                        expect(dispatch).not.toHaveBeenCalled();
                    },
                    done: done,
                });
                runner.queueRequest({ identifier: identifier, datasource: datasource });
            });
        });
    });
    describe('cancellation cases', function () {
        describe('long running request is cancelled', function () {
            it('then it should work as expected', function (done) {
                var _a = getTestContext(), identifier = _a.identifier, datasource = _a.datasource, runner = _a.runner, queryRunner = _a.queryRunner;
                queryRunner.runRequest = jest
                    .fn()
                    .mockReturnValue(of({ series: [], state: LoadingState.Done }).pipe(delay(10000)));
                expectOnResults({
                    identifier: identifier,
                    runner: runner,
                    expect: function (results) {
                        // verify that the observable works as expected
                        expect(results).toEqual([
                            { state: LoadingState.Loading, identifier: identifier },
                            { state: LoadingState.Loading, identifier: identifier, cancelled: true },
                            { state: LoadingState.Done, identifier: identifier },
                        ]);
                    },
                    done: done,
                });
                runner.queueRequest({ identifier: identifier, datasource: datasource });
                runner.cancelRequest(identifier);
            });
        });
        describe('an identical request is triggered before first request is finished', function () {
            it('then it should work as expected', function (done) {
                var _a = getTestContext(), identifier = _a.identifier, datasource = _a.datasource, runner = _a.runner, queryRunner = _a.queryRunner;
                queryRunner.runRequest = jest
                    .fn()
                    .mockReturnValueOnce(of({ series: [], state: LoadingState.Done }).pipe(delay(10000)))
                    .mockReturnValue(of({ series: [], state: LoadingState.Done }));
                expectOnResults({
                    identifier: identifier,
                    runner: runner,
                    expect: function (results) {
                        // verify that the observable works as expected
                        expect(results).toEqual([
                            { state: LoadingState.Loading, identifier: identifier },
                            { state: LoadingState.Loading, identifier: identifier },
                            { state: LoadingState.Loading, identifier: identifier, cancelled: true },
                            { state: LoadingState.Done, identifier: identifier },
                        ]);
                    },
                    done: done,
                });
                runner.queueRequest({ identifier: identifier, datasource: datasource });
                runner.queueRequest({ identifier: identifier, datasource: datasource });
            });
        });
    });
});
//# sourceMappingURL=VariableQueryRunner.test.js.map