import { GraphCtrl } from '../module';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';

jest.mock('../graph', () => ({}));

describe('GraphCtrl', () => {
  const injector = {
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

  const scope = {
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

  const ctx = {} as any;

  beforeEach(() => {
    ctx.ctrl = new GraphCtrl(scope, injector as any, {} as any);
    ctx.ctrl.events = {
      emit: () => {},
    };
    ctx.ctrl.annotationsPromise = Promise.resolve({});
    ctx.ctrl.updateTimeRange();
  });

  describe('when time series are outside range', () => {
    beforeEach(() => {
      const data = [
        {
          target: 'test.cpu1',
          datapoints: [[45, 1234567890], [60, 1234567899]],
        },
      ];

      ctx.ctrl.range = { from: dateTime().valueOf(), to: dateTime().valueOf() };
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsOutside', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('Data points outside time range');
    });
  });

  describe('when time series are inside range', () => {
    beforeEach(() => {
      const range = {
        from: dateTime()
          .subtract(1, 'days')
          .valueOf(),
        to: dateTime().valueOf(),
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
      const data: any = [{ target: 'test.cpu1', datapoints: [] }, { target: 'test.cpu2', datapoints: [] }];
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsCount warning', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('No data points');
    });
  });
});
