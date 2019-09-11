import { DataFrame, LoadingState, dateTime } from '@grafana/data';
import { PanelData, DataSourceApi, DataQueryRequest, DataQueryResponse } from '@grafana/ui';
import { Subscriber, Observable, Subscription } from 'rxjs';
import { runRequest } from './runRequest';

jest.mock('app/core/services/backend_srv');

class ScenarioCtx {
  ds: DataSourceApi;
  request: DataQueryRequest;
  subscriber: Subscriber<DataQueryResponse>;
  isUnsubbed = false;
  setupFn: () => void = () => {};
  results: PanelData[];
  subscription: Subscription;
  wasStarted = false;
  error: Error = null;
  toStartTime = dateTime();
  fromStartTime = dateTime();

  reset() {
    this.wasStarted = false;
    this.isUnsubbed = false;

    this.results = [];
    this.request = {
      range: {
        from: this.toStartTime,
        to: this.fromStartTime,
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
        return new Observable<DataQueryResponse>(subscriber => {
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
      ctx.reset();
      return ctx.setupFn();
    });

    fn(ctx);
  });
}

describe('runRequest', () => {
  runRequestScenario('with no queries', ctx => {
    ctx.setup(() => {
      ctx.request.targets = [];
      ctx.start();
    });

    it('should emit empty result with loading state done', () => {
      expect(ctx.wasStarted).toBe(false);
      expect(ctx.results[0].state).toBe(LoadingState.Done);
    });
  });

  runRequestScenario('After first response', ctx => {
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

  runRequestScenario('After tree responses, 2 with different keys', ctx => {
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

    it('should emit 3 seperate results', () => {
      expect(ctx.results.length).toBe(3);
    });

    it('should combine results and return latest data for key A', () => {
      expect(ctx.results[2].series).toEqual([{ name: 'DataA-2' }, { name: 'DataB-1' }]);
    });

    it('should have loading state Done', () => {
      expect(ctx.results[2].state).toEqual(LoadingState.Done);
    });
  });

  runRequestScenario('After response with state Streaming', ctx => {
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

  runRequestScenario('If no response after 250ms', ctx => {
    ctx.setup(async () => {
      ctx.start();
      await sleep(250);
    });

    it('should emit 1 result with loading state', () => {
      expect(ctx.results.length).toBe(1);
      expect(ctx.results[0].state).toBe(LoadingState.Loading);
    });
  });

  runRequestScenario('on thrown error', ctx => {
    ctx.setup(() => {
      ctx.error = new Error('Ohh no');
      ctx.start();
    });

    it('should emit 1 error result', () => {
      expect(ctx.results[0].error.message).toBe('Ohh no');
      expect(ctx.results[0].state).toBe(LoadingState.Error);
    });
  });

  runRequestScenario('If time range is relative', ctx => {
    ctx.setup(async () => {
      ctx.start();
      // wait a bit
      await sleep(20);

      ctx.emitPacket({ data: [{ name: 'DataB-1' } as DataFrame] });
    });

    it('should update returned request range', () => {
      expect(ctx.results[0].request.range.to.valueOf()).not.toBe(ctx.fromStartTime);
    });
  });
});

async function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
