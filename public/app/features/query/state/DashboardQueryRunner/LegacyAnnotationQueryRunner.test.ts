import { LegacyAnnotationQueryRunner } from './LegacyAnnotationQueryRunner';
import { getDefaultTimeRange } from '@grafana/data';
import { AnnotationQueryRunnerOptions } from './types';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';

function getDefaultOptions(annotationQuery?: jest.Mock): AnnotationQueryRunnerOptions {
  const annotation: any = {};
  const dashboard: any = {};
  const datasource: any = {
    annotationQuery: annotationQuery ?? jest.fn().mockResolvedValue([{ id: '1' }]),
  };
  const range = getDefaultTimeRange();

  return { annotation, datasource, dashboard, range };
}

describe('LegacyAnnotationQueryRunner', () => {
  const runner = new LegacyAnnotationQueryRunner();

  describe('when canRun is called with correct props', () => {
    it('then it should return true', () => {
      const datasource: any = {
        annotationQuery: jest.fn(),
      };

      expect(runner.canRun(datasource)).toBe(true);
    });
  });

  describe('when canRun is called with incorrect props', () => {
    it('then it should return false', () => {
      const datasource: any = {
        annotationQuery: {},
        annotations: {},
      };

      expect(runner.canRun(datasource)).toBe(false);
    });
  });

  describe('when run is called and the request is successful', () => {
    it('then it should return the correct results', async () => {
      const options = getDefaultOptions();

      await expect(runner.run(options)).toEmitValues([[{ id: '1' }]]);
    });
  });

  describe('when run is called and the request fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      jest.clearAllMocks();
      const annotationQuery = jest.fn().mockRejectedValue({ message: 'An error' });
      const spy = jest.spyOn(store, 'dispatch');
      const options = getDefaultOptions(annotationQuery);

      await expect(runner.run(options)).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);
        const results = received[0];
        expect(results).toEqual([]);
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called and the request is cancelled', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      jest.clearAllMocks();
      const annotationQuery = jest.fn().mockRejectedValue({ cancelled: true });
      const spy = jest.spyOn(store, 'dispatch');
      const options = getDefaultOptions(annotationQuery);

      await expect(runner.run(options)).toEmitValuesWith((received) => {
        expect(received.length).toBe(1);
        const results = received[0];
        expect(results).toEqual([]);
        expect(spy).not.toHaveBeenCalled();
      });
    });
  });
});
