import { AnnotationEvent, AnnotationQuery, getDefaultTimeRange } from '@grafana/data';
import { Dashboard } from '@grafana/schema';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { SnapshotWorker } from './SnapshotWorker';
import { DashboardQueryRunnerOptions } from './types';

function getDefaultOptions(): DashboardQueryRunnerOptions {
  const dashboard = new DashboardModel({} as Dashboard);
  const range = getDefaultTimeRange();

  return { dashboard, range };
}

function getSnapshotData(annotation: AnnotationQuery, timeEnd: number | undefined = undefined): AnnotationEvent[] {
  return [{ annotation, source: {}, timeEnd, time: 1 }];
}

function getAnnotation(timeEnd: number | undefined = undefined): AnnotationQuery {
  const annotation = {
    enable: true,
    hide: false,
    name: 'Test',
    iconColor: 'pink',
  };

  return {
    ...annotation,
    snapshotData: getSnapshotData(annotation, timeEnd),
  };
}

describe('SnapshotWorker', () => {
  const worker = new SnapshotWorker();

  describe('when canWork is called with correct props', () => {
    it('then it should return true', () => {
      const dashboard = { annotations: { list: [getAnnotation(), {}] } } as unknown as DashboardModel;
      const options = { ...getDefaultOptions(), dashboard };

      expect(worker.canWork(options)).toBe(true);
    });
  });

  describe('when canWork is called with incorrect props', () => {
    it('then it should return false', () => {
      const dashboard = { annotations: { list: [{}] } } as unknown as DashboardModel;
      const options = { ...getDefaultOptions(), dashboard };

      expect(worker.canWork(options)).toBe(false);
    });
  });

  describe('when run is called with incorrect props', () => {
    it('then it should return the correct results', async () => {
      const dashboard = { annotations: { list: [{}] } } as unknown as DashboardModel;
      const options = { ...getDefaultOptions(), dashboard };

      await expect(worker.work(options)).toEmitValues([{ alertStates: [], annotations: [] }]);
    });
  });

  describe('when run is called with correct props', () => {
    it('then it should return the correct results', async () => {
      const noRegionUndefined = getAnnotation();
      const noRegionEqualTime = getAnnotation(1);
      const region = getAnnotation(2);
      const noSnapshotData = { ...getAnnotation(), snapshotData: undefined };
      const dashboard = {
        annotations: { list: [noRegionUndefined, region, noSnapshotData, noRegionEqualTime] },
      } as unknown as DashboardModel;
      const options = { ...getDefaultOptions(), dashboard };

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const { alertStates, annotations } = received[0];
        expect(alertStates).toBeDefined();
        expect(annotations).toHaveLength(3);
        expect(annotations[0]).toEqual({
          annotation: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
          source: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
          timeEnd: undefined,
          time: 1,
          color: '#ffc0cb',
          type: 'Test',
          isRegion: false,
        });
        expect(annotations[1]).toEqual({
          annotation: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
          source: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
          timeEnd: 2,
          time: 1,
          color: '#ffc0cb',
          type: 'Test',
          isRegion: true,
        });
        expect(annotations[2]).toEqual({
          annotation: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
          source: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
          timeEnd: 1,
          time: 1,
          color: '#ffc0cb',
          type: 'Test',
          isRegion: false,
        });
      });
    });
  });
});
