import { dateTime } from '@grafana/data';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { HeatmapCtrl } from '../heatmap_ctrl';

describe('HeatmapCtrl', () => {
  const ctx = {} as any;

  const $injector = {
    get: () => {},
  };

  HeatmapCtrl.prototype.panel = {
    events: {
      on: () => {},
      emit: () => {},
    },
  };

  const $scope = {
    $on: () => {},
    $parent: {
      panel: HeatmapCtrl.prototype.panel,
      dashboard: {},
    },
  };

  beforeEach(() => {
    //@ts-ignore
    ctx.ctrl = new HeatmapCtrl($scope, $injector, {} as TimeSrv);
  });

  describe('when time series are outside range', () => {
    beforeEach(() => {
      const data: any = [
        {
          target: 'test.cpu1',
          datapoints: [
            [45, 1234567890],
            [60, 1234567899],
          ],
        },
      ];

      ctx.ctrl.range = { from: dateTime().valueOf(), to: dateTime().valueOf() };
      ctx.ctrl.onSnapshotLoad(data);
    });

    it('should set datapointsOutside', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('Data points outside time range');
    });
  });

  describe('when time series are inside range', () => {
    beforeEach(() => {
      const range = {
        from: dateTime().subtract(1, 'days').valueOf(),
        to: dateTime().valueOf(),
      };

      const data: any = [
        {
          target: 'test.cpu1',
          datapoints: [
            [45, range.from + 1000],
            [60, range.from + 10000],
          ],
        },
      ];

      ctx.ctrl.range = range;
      ctx.ctrl.onSnapshotLoad(data);
    });

    it('should set datapointsOutside', () => {
      expect(ctx.ctrl.dataWarning).toBe(null);
    });
  });

  describe('datapointsCount given 2 series', () => {
    beforeEach(() => {
      const data: any = [
        { target: 'test.cpu1', datapoints: [] },
        { target: 'test.cpu2', datapoints: [] },
      ];
      ctx.ctrl.onSnapshotLoad(data);
    });

    it('should set datapointsCount warning', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('No data points');
    });
  });
});
