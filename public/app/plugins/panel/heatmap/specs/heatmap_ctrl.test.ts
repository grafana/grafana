import { HeatmapCtrl } from '../heatmap_ctrl';
import { momentWrapper } from 'app/core/moment_wrapper';

describe('HeatmapCtrl', () => {
  const ctx = {} as any;

  const $injector = {
    get: () => {},
  };

  const $scope = {
    $on: () => {},
  };

  HeatmapCtrl.prototype.panel = {
    events: {
      on: () => {},
      emit: () => {},
    },
  };

  beforeEach(() => {
    ctx.ctrl = new HeatmapCtrl($scope, $injector, {});
  });

  describe('when time series are outside range', () => {
    beforeEach(() => {
      const data = [
        {
          target: 'test.cpu1',
          datapoints: [[45, 1234567890], [60, 1234567899]],
        },
      ];

      ctx.ctrl.range = { from: momentWrapper().valueOf(), to: momentWrapper().valueOf() };
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsOutside', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('Data points outside time range');
    });
  });

  describe('when time series are inside range', () => {
    beforeEach(() => {
      const range = {
        from: momentWrapper()
          .subtract(1, 'days')
          .valueOf(),
        to: momentWrapper().valueOf(),
      };

      const data = [
        {
          target: 'test.cpu1',
          datapoints: [[45, range.from + 1000], [60, range.from + 10000]],
        },
      ];

      ctx.ctrl.range = range;
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsOutside', () => {
      expect(ctx.ctrl.dataWarning).toBe(null);
    });
  });

  describe('datapointsCount given 2 series', () => {
    beforeEach(() => {
      const data = [{ target: 'test.cpu1', datapoints: [] }, { target: 'test.cpu2', datapoints: [] }];
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsCount warning', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('No data points');
    });
  });
});
