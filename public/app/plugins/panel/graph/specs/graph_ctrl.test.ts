import { GraphCtrl } from '../module';
import { dateTime } from '@grafana/data';
import TimeSeries from 'app/core/time_series2';

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

  const scope: any = {
    $on: () => {},
  };

  GraphCtrl.prototype.panel = {
    events: {
      on: () => {},
      emit: () => {},
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
    ctx.ctrl.annotationsSrv = {
      getAnnotations: () => Promise.resolve({}),
    };
    ctx.ctrl.annotationsPromise = Promise.resolve({});
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
        from: dateTime()
          .subtract(1, 'days')
          .valueOf(),
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
      expect(ctx.ctrl.dataWarning).toBe(null);
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

  describe('when data is exported to CSV', () => {
    const appEventMock = jest.fn();

    beforeEach(() => {
      appEventMock.mockReset();
      scope.$root = { appEvent: appEventMock };
      scope.$new = () => ({});
      const data = [
        {
          target: 'test.normal',
          datapoints: [
            [10, 1],
            [10, 2],
          ],
        },
        {
          target: 'test.nulls',
          datapoints: [
            [null, 1],
            [null, 2],
          ],
        },
        {
          target: 'test.zeros',
          datapoints: [
            [0, 1],
            [0, 2],
          ],
        },
      ];
      ctx.ctrl.onDataSnapshotLoad(data);
      // allIsNull / allIsZero are set by getFlotPairs
      ctx.ctrl.seriesList.forEach((series: TimeSeries) => series.getFlotPairs(''));
    });

    const thenExportYieldedNSeries = (n: number) => {
      expect(appEventMock.mock.calls.length).toBe(1);
      const eventPayload = appEventMock.mock.calls[0][1];
      expect(eventPayload.scope.seriesList).toHaveLength(n);
    };

    const thenExportDidNotYieldSeriesName = (unexpectedName: string) => {
      expect(appEventMock.mock.calls.length).toBe(1);
      const eventPayload = appEventMock.mock.calls[0][1];
      expect(
        eventPayload.scope.seriesList.filter((series: TimeSeries) => series.label === unexpectedName)
      ).toHaveLength(0);
    };

    it('should not ignore anything if not asked to', () => {
      ctx.ctrl.exportCsv();
      thenExportYieldedNSeries(3);
    });

    it('should ignore all-null series when asked to', () => {
      ctx.ctrl.panel.legend.hideEmpty = true;
      ctx.ctrl.exportCsv();
      thenExportYieldedNSeries(2);
      thenExportDidNotYieldSeriesName('test.nulls');
    });

    it('should ignore all-zero series when asked to', () => {
      ctx.ctrl.panel.legend.hideZero = true;
      ctx.ctrl.exportCsv();
      // impl treats all-null series as all-zero as well
      thenExportYieldedNSeries(1);
      thenExportDidNotYieldSeriesName('test.zeros');
      thenExportDidNotYieldSeriesName('test.empty');
    });

    it('should ignore both when asked to', () => {
      ctx.ctrl.panel.legend.hideZero = true;
      ctx.ctrl.panel.legend.hideEmpty = true;
      ctx.ctrl.exportCsv();
      thenExportYieldedNSeries(1);
      thenExportDidNotYieldSeriesName('test.zeros');
      thenExportDidNotYieldSeriesName('test.empty');
    });
  });
});
