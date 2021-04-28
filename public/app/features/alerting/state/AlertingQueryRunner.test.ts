import { BackendSrv } from 'app/core/services/backend_srv';
import { ColdObservable } from 'rxjs/internal/testing/ColdObservable';
import { TestScheduler } from 'rxjs/testing';
import { AlertingQueryResponse, AlertingQueryRunner } from './AlertingQueryRunner';

const testScheduler = new TestScheduler((actual, expected) => {
  expect(actual).toEqual(expected);
});

describe('AlertingQueryRunner', () => {
  it('should successfully return panel data by refId', () => {
    testScheduler.run((helpers) => {
      const { expectObservable, cold } = helpers;

      const response: AlertingQueryResponse = {
        results: {},
      };

      const backendSrv = mockBackendSrv({
        fetch: () => cold('d', { d: response }),
      });

      const runner = new AlertingQueryRunner(backendSrv);

      const data = runner.get();
      runner.run([]);

      expectObservable(data).toBe('a', { a: {} });
    });
  });
});

type MockBackendSrvConfig = {
  fetch: () => ColdObservable<AlertingQueryResponse>;
};

const mockBackendSrv = ({ fetch }: MockBackendSrvConfig): BackendSrv => {
  return ({
    fetch,
  } as unknown) as BackendSrv;
};
