import { Subject, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

import { AnnotationQuery } from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { DashboardModel } from 'app/features/dashboard/state';

import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as annotationsSrv from '../../../annotations/executeAnnotationQuery';

import { AnnotationsWorker } from './AnnotationsWorker';
import {
  createDashboardQueryRunner,
  DashboardQueryRunnerFactoryArgs,
  setDashboardQueryRunnerFactory,
} from './DashboardQueryRunner';
import { getDefaultOptions, LEGACY_DS_NAME, NEXT_GEN_DS_NAME, toAsyncOfResult } from './testHelpers';
import { DashboardQueryRunnerOptions, DashboardQueryRunnerWorkerResult } from './types';
import { emptyResult } from './utils';

function getTestContext(dataSourceSrvRejects = false) {
  jest.clearAllMocks();
  const cancellations = new Subject<AnnotationQuery>();
  setDashboardQueryRunnerFactory(() => ({
    getResult: emptyResult,
    run: () => undefined,
    cancel: () => undefined,
    cancellations: () => cancellations,
    destroy: () => undefined,
  }));
  createDashboardQueryRunner({} as DashboardQueryRunnerFactoryArgs);
  const executeAnnotationQueryMock = jest
    .spyOn(annotationsSrv, 'executeAnnotationQuery')
    .mockReturnValue(toAsyncOfResult({ events: [{ id: 'NextGen' }] }));
  const annotationQueryMock = jest.fn().mockResolvedValue([{ id: 'Legacy' }]);
  const dataSourceSrvMock = {
    get: async (name: string) => {
      if (dataSourceSrvRejects) {
        return Promise.reject(`Could not find datasource with name: ${name}`);
      }
      if (name === LEGACY_DS_NAME) {
        return {
          annotationQuery: annotationQueryMock,
        };
      }

      if (name === NEXT_GEN_DS_NAME) {
        return {
          annotations: {},
        };
      }

      return {};
    },
  } as DataSourceSrv;
  setDataSourceSrv(dataSourceSrvMock);
  const options = getDefaultOptions();

  return { options, annotationQueryMock, executeAnnotationQueryMock, cancellations };
}

function expectOnResults(args: {
  worker: AnnotationsWorker;
  options: DashboardQueryRunnerOptions;
  done: jest.DoneCallback;
  expect: (results: DashboardQueryRunnerWorkerResult) => void;
}) {
  const { worker, done, options, expect: expectCallback } = args;
  const subscription = worker.work(options).subscribe({
    next: (value) => {
      try {
        expectCallback(value);
        subscription.unsubscribe();
        done();
      } catch (err) {
        subscription.unsubscribe();
        done(err);
      }
    },
  });
}

describe('AnnotationsWorker', () => {
  const worker = new AnnotationsWorker();

  describe('when canWork is called with correct props', () => {
    it('then it should return true', () => {
      const options = getDefaultOptions();

      expect(worker.canWork(options)).toBe(true);
    });
  });

  describe('when canWork is called with correct props for a public dashboard with public view', () => {
    it('then it should return true', () => {
      const options = getDefaultOptions();
      options.dashboard.meta.publicDashboardAccessToken = 'accessTokenString';

      expect(worker.canWork(options)).toBe(true);
    });
  });

  describe('when canWork is called with incorrect props', () => {
    it('then it should return false', () => {
      const dashboard = { annotations: { list: [] } } as unknown as DashboardModel;
      const options = { ...getDefaultOptions(), dashboard };

      expect(worker.canWork(options)).toBe(false);
    });
  });

  describe('when run is called with incorrect props', () => {
    it('then it should return the correct results', async () => {
      const dashboard = { annotations: { list: [] } } as unknown as DashboardModel;
      const options = { ...getDefaultOptions(), dashboard };

      await expect(worker.work(options)).toEmitValues([{ alertStates: [], annotations: [] }]);
    });
  });

  describe('when run is called with correct props and all workers are successful', () => {
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const result = received[0];
        expect(result).toEqual({
          alertStates: [],
          annotations: [
            {
              id: 'Legacy',
              source: {
                enable: true,
                hide: false,
                name: 'Test',
                iconColor: 'pink',
                snapshotData: undefined,
                datasource: 'Legacy',
              },
              color: '#ffc0cb',
              type: 'Test',
              isRegion: false,
            },
            {
              id: 'NextGen',
              source: {
                enable: true,
                hide: false,
                name: 'Test',
                iconColor: 'pink',
                snapshotData: undefined,
                datasource: 'NextGen',
              },
              color: '#ffc0cb',
              type: 'Test',
              isRegion: false,
            },
          ],
        });
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called with correct props and legacy worker fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
      annotationQueryMock.mockRejectedValue({ message: 'Some error' });

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const result = received[0];
        expect(result).toEqual({
          alertStates: [],
          annotations: [
            {
              id: 'NextGen',
              source: {
                enable: true,
                hide: false,
                name: 'Test',
                iconColor: 'pink',
                snapshotData: undefined,
                datasource: 'NextGen',
              },
              color: '#ffc0cb',
              type: 'Test',
              isRegion: false,
            },
          ],
        });
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called with correct props and a worker is cancelled', () => {
    it('then it should return the correct results', (done) => {
      const { options, executeAnnotationQueryMock, annotationQueryMock, cancellations } = getTestContext();
      executeAnnotationQueryMock.mockReturnValueOnce(
        toAsyncOfResult({ events: [{ id: 'NextGen' }] }).pipe(delay(10000))
      );

      expectOnResults({
        worker,
        options,
        done,
        expect: (results) => {
          expect(results).toEqual({
            alertStates: [],
            annotations: [
              {
                id: 'Legacy',
                source: {
                  enable: true,
                  hide: false,
                  name: 'Test',
                  iconColor: 'pink',
                  snapshotData: undefined,
                  datasource: 'Legacy',
                },
                color: '#ffc0cb',
                type: 'Test',
                isRegion: false,
              },
            ],
          });
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
          expect(annotationQueryMock).toHaveBeenCalledTimes(1);
        },
      });

      setTimeout(() => {
        // call to async needs to be async or the cancellation will be called before any of the runners have started
        cancellations.next(options.dashboard.annotations.list[1]);
      }, 100);
    });
  });

  describe('when run is called with correct props and nextgen worker fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
      executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'An error' }));

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const result = received[0];
        expect(result).toEqual({
          alertStates: [],
          annotations: [
            {
              id: 'Legacy',
              source: {
                enable: true,
                hide: false,
                name: 'Test',
                iconColor: 'pink',
                snapshotData: undefined,
                datasource: 'Legacy',
              },
              color: '#ffc0cb',
              type: 'Test',
              isRegion: false,
            },
          ],
        });
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called with correct props and both workers fail', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext();
      annotationQueryMock.mockRejectedValue({ message: 'Some error' });
      executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'An error' }));

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const result = received[0];
        expect(result).toEqual({ alertStates: [], annotations: [] });
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called with correct props and call to datasourceSrv fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock, annotationQueryMock } = getTestContext(true);

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const result = received[0];
        expect(result).toEqual({ alertStates: [], annotations: [] });
        expect(executeAnnotationQueryMock).not.toHaveBeenCalled();
        expect(annotationQueryMock).not.toHaveBeenCalled();
      });
    });
  });
});
