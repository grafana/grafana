import { dateTime } from '@grafana/data';

import { GraphCtrl } from '../module';

jest.mock('../graph', () => ({}));

describe.skip('GraphCtrl', () => {
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

  GraphCtrl.prototype.panel = {
    events: {
      on: () => {},
      emit: () => {},
    },
    gridPos: {
      w: 100,
    },
    fieldConfig: {
      defaults: {},
    },
  };

  const scope: any = {
    $on: () => {},
    $parent: {
      panel: GraphCtrl.prototype.panel,
      dashboard: {},
    },
  };

  const ctx = {} as any;

  beforeEach(() => {
    ctx.ctrl = new GraphCtrl(scope, injector as any);
    ctx.ctrl.events = {
      emit: () => {},
    };
    ctx.ctrl.panelData = {};
    ctx.ctrl.updateTimeRange();
  });

  describe('when time series are outside range', () => {
    beforeEach(() => {
      const data = [
        {
          target: 'test.cpu1',
          datapoints: [
            [45, 1234567890],
            [60, 1234567899],
          ],
        },
      ];

      ctx.ctrl.range = { from: dateTime().valueOf(), to: dateTime().valueOf() };
      ctx.ctrl.onDataSnapshotLoad(data);
    });

    it('should set datapointsOutside', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('Data outside time range');
    });
  });

  describe('when time series are inside range', () => {
    beforeEach(() => {
      const range = {
        from: dateTime().subtract(1, 'days').valueOf(),
        to: dateTime().valueOf(),
      };

      const data = [
        {
          target: 'test.cpu1',
          datapoints: [
            [45, range.from + 1000],
            [60, range.from + 10000],
          ],
        },
      ];

      ctx.ctrl.range = range;
      ctx.ctrl.onDataSnapshotLoad(data);
    });

    it('should set datapointsOutside', () => {
      expect(ctx.ctrl.dataWarning).toBeUndefined();
    });
  });

  describe('datapointsCount given 2 series', () => {
    beforeEach(() => {
      const data: any = [
        { target: 'test.cpu1', datapoints: [] },
        { target: 'test.cpu2', datapoints: [] },
      ];
      ctx.ctrl.onDataSnapshotLoad(data);
    });

    it('should set datapointsCount warning', () => {
      expect(ctx.ctrl.dataWarning.title).toBe('No data');
    });
  });
});
