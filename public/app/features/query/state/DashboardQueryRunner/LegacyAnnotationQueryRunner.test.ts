import { AnnotationQuery, DataSourceApi, getDefaultTimeRange } from '@grafana/data';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';

import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';

import { LegacyAnnotationQueryRunner } from './LegacyAnnotationQueryRunner';
import { AnnotationQueryRunnerOptions } from './types';

function getDefaultOptions(annotationQuery?: jest.Mock): AnnotationQueryRunnerOptions {
  const annotation = {} as AnnotationQuery;
  const dashboard = createDashboardModelFixture();
  const datasource = {
    annotationQuery: annotationQuery ?? jest.fn().mockResolvedValue([{ id: '1' }]),
  } as unknown as DataSourceApi;
  const range = getDefaultTimeRange();

  return { annotation, datasource, dashboard, range };
}

function getTestContext(annotationQuery?: jest.Mock) {
  jest.clearAllMocks();
  const dispatchMock = jest.spyOn(store, 'dispatch');
  const options = getDefaultOptions(annotationQuery);
  const annotationQueryMock = options.datasource!.annotationQuery;

  return { options, dispatchMock, annotationQueryMock };
}

describe('LegacyAnnotationQueryRunner', () => {
  const runner = new LegacyAnnotationQueryRunner();

  describe('when canWork is called with correct props', () => {
    it('then it should return true', () => {
      const datasource = {
        annotationQuery: jest.fn(),
      } as unknown as DataSourceApi;

      expect(runner.canRun(datasource)).toBe(true);
    });
  });

  describe('when canWork is called without datasource', () => {
    it('then it should return false', () => {
      const datasource = undefined;

      expect(runner.canRun(datasource)).toBe(false);
    });
  });

  describe('when canWork is called with incorrect props', () => {
    it('then it should return false', () => {
      const datasource = {
        annotationQuery: jest.fn(),
        annotations: {},
      } as unknown as DataSourceApi;

      expect(runner.canRun(datasource)).toBe(false);
    });
  });

  describe('when run is called with unsupported props', () => {
    it('then it should return the correct results', async () => {
      const datasource = {
        annotationQuery: jest.fn(),
        annotations: {},
      } as unknown as DataSourceApi;
      const options = { ...getDefaultOptions(), datasource };

      await expect(runner.run(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual([]);
        expect(datasource.annotationQuery).not.toHaveBeenCalled();
      });
    });
  });

  describe('when run is called and the request is successful', () => {
    it('then it should return the correct results', async () => {
      const { options, annotationQueryMock } = getTestContext();

      await expect(runner.run(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual([{ id: '1' }]);
        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called and the request fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const annotationQuery = jest.fn().mockRejectedValue({ message: 'An error' });
      const { options, annotationQueryMock, dispatchMock } = getTestContext(annotationQuery);

      await expect(runner.run(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual([]);
        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
        expect(dispatchMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called and the request is cancelled', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const annotationQuery = jest.fn().mockRejectedValue({ cancelled: true });
      const { options, annotationQueryMock, dispatchMock } = getTestContext(annotationQuery);

      await expect(runner.run(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual([]);
        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
        expect(dispatchMock).not.toHaveBeenCalled();
      });
    });
  });
});
