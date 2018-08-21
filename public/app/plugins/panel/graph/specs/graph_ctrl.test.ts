import moment from 'moment';
import { GraphCtrl } from '../module';

jest.mock('../graph', () => ({}));

describe('GraphCtrl', () => {
  let injector = {
    get: () => {
      return {
        timeRange: () => {
          return {
            from: '',
            to: '',
          };
        },
      };
    },
  };

  let scope = {
    $on: () => {},
  };

  GraphCtrl.prototype.panel = {
    events: {
      on: () => {},
    },
    gridPos: {
      w: 100,
    },
  };

  let ctx = <any>{};

  beforeEach(() => {
    ctx.ctrl = new GraphCtrl(scope, injector, {});
    ctx.ctrl.events = {
      emit: () => {},
    };
    ctx.ctrl.annotationsPromise = Promise.resolve({});
    ctx.ctrl.updateTimeRange();
  });

  describe('when time series are outside range', () => {
    beforeEach(() => {
      var data = [
        {
          target: 'test.cpu1',
          datapoints: [[45, 1234567890], [60, 1234567899]],
        },
      ];

      ctx.ctrl.range = { from: moment().valueOf(), to: moment().valueOf() };
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsOutside', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('Data points outside time range');
    });
  });

  describe('when time series are inside range', () => {
    beforeEach(() => {
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

    it('should set datapointsOutside', () => {
      expect(ctx.ctrl.dataWarning).toBe(null);
    });
  });

  describe('datapointsCount given 2 series', () => {
    beforeEach(() => {
      var data = [{ target: 'test.cpu1', datapoints: [] }, { target: 'test.cpu2', datapoints: [] }];
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsCount warning', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('No data points');
    });
  });
});
