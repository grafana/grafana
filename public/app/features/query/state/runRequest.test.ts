import { Observable, Subscriber, Subscription } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataTopic,
  dateTime,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { setEchoSrv } from '@grafana/runtime';

import { deepFreeze } from '../../../../test/core/redux/reducerTester';
import { Echo } from '../../../core/services/echo/Echo';
import { DashboardModel } from '../../dashboard/state/DashboardModel';

import { runRequest } from './runRequest';

jest.mock('app/core/services/backend_srv');

const dashboardModel = new DashboardModel({
  panels: [{ id: 1, type: 'graph' }],
});

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => {
    return {
      getCurrent: () => dashboardModel,
    };
  },
}));

class ScenarioCtx {
  ds!: DataSourceApi;
  request!: DataQueryRequest;
  subscriber!: Subscriber<DataQueryResponse>;
  isUnsubbed = false;
  setupFn: () => void = () => {};
  results!: PanelData[];
  subscription!: Subscription;
  wasStarted = false;
  error: Error | null = null;
  toStartTime = dateTime();
  fromStartTime = dateTime();

  reset() {
    this.wasStarted = false;
    this.isUnsubbed = false;

    this.results = [];
    this.request = {
      range: {
        from: this.fromStartTime,
        to: this.toStartTime,
        raw: { from: '1h', to: 'now' },
      },
      targets: [
        {
          refId: 'A',
        },
      ],
    } as DataQueryRequest;

    this.ds = {
      query: (request: DataQueryRequest) => {
        return new Observable<DataQueryResponse>((subscriber) => {
          this.subscriber = subscriber;
          this.wasStarted = true;

          if (this.error) {
            throw this.error;
          }

          return () => {
            this.isUnsubbed = true;
          };
        });
      },
    } as DataSourceApi;
  }

  start() {
    this.subscription = runRequest(this.ds, this.request).subscribe({
      next: (data: PanelData) => {
        this.results.push(data);
      },
    });
  }

  emitPacket(packet: DataQueryResponse) {
    this.subscriber.next(packet);
  }

  setup(fn: () => void) {
    this.setupFn = fn;
  }
}

function runRequestScenario(desc: string, fn: (ctx: ScenarioCtx) => void) {
  describe(desc, () => {
    const ctx = new ScenarioCtx();

    beforeEach(() => {
      setEchoSrv(new Echo());
      ctx.reset();
      return ctx.setupFn();
    });

    fn(ctx);
  });
}

function runRequestScenarioThatThrows(desc: string, fn: (ctx: ScenarioCtx) => void) {
  describe(desc, () => {
    const ctx = new ScenarioCtx();
    let consoleSpy: jest.SpyInstance<any>;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      setEchoSrv(new Echo());
      ctx.reset();
      return ctx.setupFn();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    fn(ctx);
  });
}

describe('runRequest', () => {
  runRequestScenario('with no queries', (ctx) => {
    ctx.setup(() => {
      ctx.request.targets = [];
      ctx.start();
    });

    it('should emit empty result with loading state done', () => {
      expect(ctx.wasStarted).toBe(false);
      expect(ctx.results[0].state).toBe(LoadingState.Done);
    });
  });

  runRequestScenario('After first response', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'Data' } as DataFrame],
      });
    });

    it('should emit single result with loading state done', () => {
      expect(ctx.wasStarted).toBe(true);
      expect(ctx.results.length).toBe(1);
    });
  });

  runRequestScenario('After three responses, 2 with different keys', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'DataA-1' } as DataFrame],
        key: 'A',
      });
      ctx.emitPacket({
        data: [{ name: 'DataA-2' } as DataFrame],
        key: 'A',
      });
      ctx.emitPacket({
        data: [{ name: 'DataB-1' } as DataFrame],
        key: 'B',
      });
    });

    it('should emit 3 separate results', () => {
      expect(ctx.results.length).toBe(3);
    });

    it('should combine results and return latest data for key A', () => {
      expect(ctx.results[2].series).toEqual([{ name: 'DataA-2' }, { name: 'DataB-1' }]);
    });

    it('should have loading state Done', () => {
      expect(ctx.results[2].state).toEqual(LoadingState.Done);
    });
  });

  runRequestScenario('When the key is defined in refId', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'DataX-1', refId: 'X' } as DataFrame],
      });
      ctx.emitPacket({
        data: [{ name: 'DataY-1', refId: 'Y' } as DataFrame],
      });
      ctx.emitPacket({
        data: [{ name: 'DataY-2', refId: 'Y' } as DataFrame],
      });
    });

    it('should emit 3 separate results', () => {
      expect(ctx.results.length).toBe(3);
    });

    it('should keep data for X and Y', () => {
      expect(ctx.results[2].series).toMatchInlineSnapshot(`
        Array [
          Object {
            "name": "DataX-1",
            "refId": "X",
          },
          Object {
            "name": "DataY-2",
            "refId": "Y",
          },
        ]
      `);
    });
  });

  runRequestScenario('After response with state Streaming', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'DataA-1' } as DataFrame],
        key: 'A',
      });
      ctx.emitPacket({
        data: [{ name: 'DataA-2' } as DataFrame],
        key: 'A',
        state: LoadingState.Streaming,
      });
    });

    it('should have loading state Streaming', () => {
      expect(ctx.results[1].state).toEqual(LoadingState.Streaming);
    });
  });

  runRequestScenario('If no response after 250ms', (ctx) => {
    ctx.setup(async () => {
      ctx.start();
      await sleep(250);
    });

    it('should emit 1 result with loading state', () => {
      expect(ctx.results.length).toBe(1);
      expect(ctx.results[0].state).toBe(LoadingState.Loading);
    });
  });

  runRequestScenarioThatThrows('on thrown error', (ctx) => {
    ctx.setup(() => {
      ctx.error = new Error('Ohh no');
      ctx.start();
    });

    it('should emit 1 error result', () => {
      expect(ctx.results[0].error?.message).toBe('Ohh no');
      expect(ctx.results[0].state).toBe(LoadingState.Error);
    });
  });

  runRequestScenario('If time range is relative', (ctx) => {
    ctx.setup(async () => {
      // any changes to ctx.request.range will throw and state would become LoadingState.Error
      deepFreeze(ctx.request.range);
      ctx.start();

      // wait a bit
      await sleep(20);

      ctx.emitPacket({ data: [{ name: 'DataB-1' } as DataFrame], state: LoadingState.Streaming });
    });

    it('should add the correct timeRange property and the request range should not be mutated', () => {
      expect(ctx.results[0].timeRange.to.valueOf()).toBeDefined();
      expect(ctx.results[0].timeRange.to.valueOf()).not.toBe(ctx.toStartTime.valueOf());
      expect(ctx.results[0].timeRange.to.valueOf()).not.toBe(ctx.results[0].request?.range?.to.valueOf());

      expectThatRangeHasNotMutated(ctx);
    });
  });

  runRequestScenario('If time range is not relative', (ctx) => {
    ctx.setup(async () => {
      ctx.request.range!.raw.from = ctx.fromStartTime;
      ctx.request.range!.raw.to = ctx.toStartTime;
      // any changes to ctx.request.range will throw and state would become LoadingState.Error
      deepFreeze(ctx.request.range);
      ctx.start();

      // wait a bit
      await sleep(20);

      ctx.emitPacket({ data: [{ name: 'DataB-1' } as DataFrame] });
    });

    it('should add the correct timeRange property and the request range should not be mutated', () => {
      expect(ctx.results[0].timeRange).toBeDefined();
      expect(ctx.results[0].timeRange.to.valueOf()).toBe(ctx.toStartTime.valueOf());
      expect(ctx.results[0].timeRange.to.valueOf()).toBe(ctx.results[0].request?.range?.to.valueOf());

      expectThatRangeHasNotMutated(ctx);
    });
  });

  runRequestScenario('With annotations dataTopic', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'DataA-1' } as DataFrame],
        key: 'A',
      });
      ctx.emitPacket({
        data: [{ name: 'DataA-2', meta: { dataTopic: DataTopic.Annotations } } as DataFrame],
        key: 'B',
      });
    });

    it('should separate annotations results', () => {
      expect(ctx.results[1].annotations?.length).toBe(1);
      expect(ctx.results[1].series.length).toBe(1);
    });
  });
});

const expectThatRangeHasNotMutated = (ctx: ScenarioCtx) => {
  // Make sure that the range for request is not changed and that deepfreeze hasn't thrown
  expect(ctx.results[0].request?.range?.to.valueOf()).toBe(ctx.toStartTime.valueOf());
  expect(ctx.results[0].error).not.toBeDefined();
};

async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
