import moment from 'moment';
import { HeatmapCtrl } from '../heatmap_ctrl';

describe('HeatmapCtrl', function() {
  let ctx = <any>{};

  let $injector = {
    get: () => {},
  };

  let $scope = {
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

  describe('when time series are outside range', function() {
    beforeEach(function() {
      var data = [
        {
          target: 'test.cpu1',
          datapoints: [[45, 1234567890], [60, 1234567899]],
        },
      ];

      ctx.ctrl.range = { from: moment().valueOf(), to: moment().valueOf() };
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsOutside', function() {
      expect(ctx.ctrl.dataWarning.title).toBe('Data points outside time range');
    });
  });

  describe('when time series are inside range', function() {
    beforeEach(function() {
      var range = {
        from: moment()
          .subtract(1, 'days')
          .valueOf(),
        to: moment().valueOf(),
      };

      var data = [
        {
          target: 'test.cpu1',
          datapoints: [[45, range.from + 1000], [60, range.from + 10000]],
        },
      ];

      ctx.ctrl.range = range;
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsOutside', function() {
      expect(ctx.ctrl.dataWarning).toBe(null);
    });
  });

  describe('datapointsCount given 2 series', function() {
    beforeEach(function() {
      var data = [{ target: 'test.cpu1', datapoints: [] }, { target: 'test.cpu2', datapoints: [] }];
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsCount warning', function() {
      expect(ctx.ctrl.dataWarning.title).toBe('No data points');
    });
  });
});
