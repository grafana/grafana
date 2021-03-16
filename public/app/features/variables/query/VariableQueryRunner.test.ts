import { of, throwError } from 'rxjs';
import { getDefaultTimeRange, LoadingState, VariableSupportType } from '@grafana/data';
import { delay } from 'rxjs/operators';

import { UpdateOptionsResults, VariableQueryRunner } from './VariableQueryRunner';
import { queryBuilder } from '../shared/testing/builders';
import { QueryRunner, QueryRunners } from './queryRunners';
import { toVariableIdentifier, VariableIdentifier } from '../state/types';
import { QueryVariableModel } from '../types';
import { updateVariableOptions, updateVariableTags } from './reducer';

type DoneCallback = {
  (...args: any[]): any;
  fail(error?: string | { message: string }): any;
};

function expectOnResults(args: {
  runner: VariableQueryRunner;
  identifier: VariableIdentifier;
  done: DoneCallback;
  expect: (results: UpdateOptionsResults[]) => void;
}) {
  const { runner, identifier, done, expect: expectCallback } = args;
  const results: UpdateOptionsResults[] = [];
  const subscription = runner.getResponse(identifier).subscribe({
    next: (value) => {
      results.push(value);
      if (value.state === LoadingState.Done || value.state === LoadingState.Error) {
        try {
          expectCallback(results);
          subscription.unsubscribe();
          done();
        } catch (err) {
          subscription.unsubscribe();
          done.fail(err);
        }
      }
    },
  });
}

function getTestContext(variable?: QueryVariableModel) {
  variable = variable ?? queryBuilder().withId('query').build();
  const getTimeSrv = jest.fn().mockReturnValue({
    timeRange: jest.fn().mockReturnValue(getDefaultTimeRange()),
  });
  const datasource: any = { metricFindQuery: jest.fn().mockResolvedValue([]) };
  const identifier = toVariableIdentifier(variable);
  const searchFilter = undefined;
  const getTemplatedRegex = jest.fn().mockReturnValue('getTemplatedRegex result');
  const dispatch = jest.fn().mockResolvedValue({});
  const getState = jest.fn().mockReturnValue({
    templating: {
      transaction: {
        uid: '0123456789',
      },
    },
    variables: {
      [variable.id]: variable,
    },
  });
  const queryRunner: QueryRunner = {
    type: VariableSupportType.Standard,
    canRun: jest.fn().mockReturnValue(true),
    getTarget: jest.fn().mockReturnValue({ refId: 'A', query: 'A query' }),
    runRequest: jest.fn().mockReturnValue(of({ series: [], state: LoadingState.Done })),
  };
  const queryRunners = ({
    getRunnerForDatasource: jest.fn().mockReturnValue(queryRunner),
  } as unknown) as QueryRunners;
  const getVariable = jest.fn().mockReturnValue(variable);
  const runRequest = jest.fn().mockReturnValue(of({}));
  const runner = new VariableQueryRunner({
    getTimeSrv,
    getTemplatedRegex,
    dispatch,
    getState,
    getVariable,
    queryRunners,
    runRequest,
  });

  return {
    identifier,
    datasource,
    runner,
    searchFilter,
    getTemplatedRegex,
    dispatch,
    getState,
    queryRunner,
    queryRunners,
    getVariable,
    runRequest,
    variable,
    getTimeSrv,
  };
}

describe('VariableQueryRunner', () => {
  describe('happy case', () => {
    it('then it should work as expected', (done) => {
      const {
        identifier,
        runner,
        datasource,
        getState,
        getVariable,
        queryRunners,
        queryRunner,
        dispatch,
      } = getTestContext();

      expectOnResults({
        identifier,
        runner,
        expect: (results) => {
          // verify that the observable works as expected
          expect(results).toEqual([
            { state: LoadingState.Loading, identifier },
            { state: LoadingState.Done, identifier },
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
          expect(dispatch.mock.calls[0][0]).toEqual(
            updateVariableOptions({
              id: 'query',
              type: 'query',
              data: { results: [], templatedRegex: 'getTemplatedRegex result' },
            })
          );
        },
        done,
      });

      runner.queueRequest({ identifier, datasource });
    });
  });

  describe('tags case', () => {
    it('then it should work as expected', (done) => {
      const variable = queryBuilder().withId('query').withTags(true).withTagsQuery('A tags query').build();
      const {
        identifier,
        runner,
        datasource,
        getState,
        getVariable,
        queryRunners,
        queryRunner,
        dispatch,
      } = getTestContext(variable);

      expectOnResults({
        identifier,
        runner,
        expect: (results) => {
          // verify that the observable works as expected
          expect(results).toEqual([
            { state: LoadingState.Loading, identifier },
            { state: LoadingState.Done, identifier },
          ]);

          // verify that mocks have been called as expected
          expect(getState).toHaveBeenCalledTimes(3);
          expect(getVariable).toHaveBeenCalledTimes(1);
          expect(queryRunners.getRunnerForDatasource).toHaveBeenCalledTimes(1);
          expect(queryRunner.getTarget).toHaveBeenCalledTimes(1);
          expect(queryRunner.runRequest).toHaveBeenCalledTimes(1);
          expect(datasource.metricFindQuery).toHaveBeenCalledTimes(1);

          // updateVariableOptions, updateVariableTags and validateVariableSelectionState
          expect(dispatch).toHaveBeenCalledTimes(3);
          expect(dispatch.mock.calls[0][0]).toEqual(
            updateVariableOptions({
              id: 'query',
              type: 'query',
              data: { results: [], templatedRegex: 'getTemplatedRegex result' },
            })
          );
          expect(dispatch.mock.calls[1][0]).toEqual(updateVariableTags({ id: 'query', type: 'query', data: [] }));
        },
        done,
      });

      runner.queueRequest({ identifier, datasource });
    });
  });

  describe('error cases', () => {
    describe('queryRunners.getRunnerForDatasource throws', () => {
      it('then it should work as expected', (done) => {
        const {
          identifier,
          runner,
          datasource,
          getState,
          getVariable,
          queryRunners,
          queryRunner,
          dispatch,
        } = getTestContext();

        queryRunners.getRunnerForDatasource = jest.fn().mockImplementation(() => {
          throw new Error('getRunnerForDatasource error');
        });

        expectOnResults({
          identifier,
          runner,
          expect: (results) => {
            // verify that the observable works as expected
            expect(results).toEqual([
              { state: LoadingState.Loading, identifier },
              { state: LoadingState.Error, identifier, error: new Error('getRunnerForDatasource error') },
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
          done,
        });

        runner.queueRequest({ identifier, datasource });
      });
    });

    describe('runRequest throws', () => {
      it('then it should work as expected', (done) => {
        const {
          identifier,
          runner,
          datasource,
          getState,
          getVariable,
          queryRunners,
          queryRunner,
          dispatch,
        } = getTestContext();

        queryRunner.runRequest = jest.fn().mockReturnValue(throwError(new Error('runRequest error')));

        expectOnResults({
          identifier,
          runner,
          expect: (results) => {
            // verify that the observable works as expected
            expect(results).toEqual([
              { state: LoadingState.Loading, identifier },
              { state: LoadingState.Error, identifier, error: new Error('runRequest error') },
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
          done,
        });

        runner.queueRequest({ identifier, datasource });
      });
    });

    describe('metricFindQuery throws', () => {
      it('then it should work as expected', (done) => {
        const variable = queryBuilder().withId('query').withTags(true).withTagsQuery('A tags query').build();
        const {
          identifier,
          runner,
          datasource,
          getState,
          getVariable,
          queryRunners,
          queryRunner,
          dispatch,
        } = getTestContext(variable);

        datasource.metricFindQuery = jest.fn().mockRejectedValue(new Error('metricFindQuery error'));

        expectOnResults({
          identifier,
          runner,
          expect: (results) => {
            // verify that the observable works as expected
            expect(results).toEqual([
              { state: LoadingState.Loading, identifier },
              { state: LoadingState.Error, identifier, error: new Error('metricFindQuery error') },
            ]);

            // verify that mocks have been called as expected
            expect(getState).toHaveBeenCalledTimes(3);
            expect(getVariable).toHaveBeenCalledTimes(1);
            expect(queryRunners.getRunnerForDatasource).toHaveBeenCalledTimes(1);
            expect(queryRunner.getTarget).toHaveBeenCalledTimes(1);
            expect(queryRunner.runRequest).toHaveBeenCalledTimes(1);
            expect(datasource.metricFindQuery).toHaveBeenCalledTimes(1);
            expect(dispatch).toHaveBeenCalledTimes(1);
          },
          done,
        });

        runner.queueRequest({ identifier, datasource });
      });
    });
  });

  describe('cancellation cases', () => {
    describe('long running request is cancelled', () => {
      it('then it should work as expected', (done) => {
        const { identifier, datasource, runner, queryRunner } = getTestContext();

        queryRunner.runRequest = jest
          .fn()
          .mockReturnValue(of({ series: [], state: LoadingState.Done }).pipe(delay(10000)));

        expectOnResults({
          identifier,
          runner,
          expect: (results) => {
            // verify that the observable works as expected
            expect(results).toEqual([
              { state: LoadingState.Loading, identifier },
              { state: LoadingState.Loading, identifier, cancelled: true },
              { state: LoadingState.Done, identifier },
            ]);
          },
          done,
        });

        runner.queueRequest({ identifier, datasource });
        runner.cancelRequest(identifier);
      });
    });

    describe('an identical request is triggered before first request is finished', () => {
      it('then it should work as expected', (done) => {
        const { identifier, datasource, runner, queryRunner } = getTestContext();

        queryRunner.runRequest = jest
          .fn()
          .mockReturnValueOnce(of({ series: [], state: LoadingState.Done }).pipe(delay(10000)))
          .mockReturnValue(of({ series: [], state: LoadingState.Done }));

        expectOnResults({
          identifier,
          runner,
          expect: (results) => {
            // verify that the observable works as expected
            expect(results).toEqual([
              { state: LoadingState.Loading, identifier },
              { state: LoadingState.Loading, identifier },
              { state: LoadingState.Loading, identifier, cancelled: true },
              { state: LoadingState.Done, identifier },
            ]);
          },
          done,
        });

        runner.queueRequest({ identifier, datasource });
        runner.queueRequest({ identifier, datasource });
      });
    });
  });
});
