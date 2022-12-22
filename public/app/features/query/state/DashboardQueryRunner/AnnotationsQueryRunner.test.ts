import { Observable, of, throwError } from 'rxjs';

import { getDefaultTimeRange } from '@grafana/data';

import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';
import * as annotationsSrv from '../../../annotations/executeAnnotationQuery';

import { AnnotationsQueryRunner } from './AnnotationsQueryRunner';
import { toAsyncOfResult } from './testHelpers';
import { AnnotationQueryRunnerOptions } from './types';

function getDefaultOptions(): AnnotationQueryRunnerOptions {
  const annotation: any = {};
  const dashboard: any = {};
  const datasource: any = {
    annotationQuery: {},
    annotations: {},
  };
  const range = getDefaultTimeRange();

  return { annotation, datasource, dashboard, range };
}

function getTestContext(result: Observable<any> = toAsyncOfResult({ events: [{ id: '1' }] })) {
  jest.clearAllMocks();
  const dispatchMock = jest.spyOn(store, 'dispatch');
  const options = getDefaultOptions();
  const executeAnnotationQueryMock = jest.spyOn(annotationsSrv, 'executeAnnotationQuery').mockReturnValue(result);

  return { options, dispatchMock, executeAnnotationQueryMock };
}

describe('AnnotationsQueryRunner', () => {
  const runner = new AnnotationsQueryRunner();

  describe('when canWork is called with correct props', () => {
    it('then it should return true', () => {
      const datasource: any = {
        annotationQuery: jest.fn(),
        annotations: {},
      };

      expect(runner.canRun(datasource)).toBe(true);
    });
  });

  describe('when canWork is called without datasource', () => {
    it('then it should return false', () => {
      const datasource: any = undefined;

      expect(runner.canRun(datasource)).toBe(false);
    });
  });

  describe('when canWork is called with incorrect props', () => {
    it('then it should return false', () => {
      const datasource: any = {
        annotationQuery: jest.fn(),
      };

      expect(runner.canRun(datasource)).toBe(false);
    });
  });

  describe('when run is called with unsupported props', () => {
    it('then it should return the correct results', async () => {
      const datasource: any = {
        annotationQuery: jest.fn(),
      };
      const { options, executeAnnotationQueryMock } = getTestContext();

      await expect(runner.run({ ...options, datasource })).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual([]);
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe('when run is called and the request is successful', () => {
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock } = getTestContext();

      await expect(runner.run(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual([{ id: '1' }]);
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('but result is missing events prop', () => {
      it('then it should return the correct results', async () => {
        const { options, executeAnnotationQueryMock } = getTestContext(of({ id: '1' }));

        await expect(runner.run(options)).toEmitValuesWith((received) => {
          expect(received).toHaveLength(1);
          const results = received[0];
          expect(results).toEqual([]);
          expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('when run is called and the request fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock, dispatchMock } = getTestContext(throwError({ message: 'An error' }));

      await expect(runner.run(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual([]);
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        expect(dispatchMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called and the request is cancelled', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { options, executeAnnotationQueryMock, dispatchMock } = getTestContext(throwError({ cancelled: true }));

      await expect(runner.run(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual([]);
        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
        expect(dispatchMock).not.toHaveBeenCalled();
      });
    });
  });
});
