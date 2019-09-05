jest.mock('app/core/services/backend_srv');

import { DataFrame, LoadingState } from '@grafana/data';
import { PanelData, DataSourceApi, DataQueryRequest, DataQueryResponsePacket } from '@grafana/ui';
import { Subscriber, Observable, Subscription } from 'rxjs';
import { runRequest } from './runRequest';

class ScenarioCtx {
  ds: DataSourceApi;
  request: DataQueryRequest;
  subscriber: Subscriber<DataQueryResponsePacket>;
  isUnsubbed = false;
  setupFn: () => void = () => {};
  results: PanelData[];
  subscription: Subscription;
  wasStarted = false;

  reset() {
    this.wasStarted = false;
    this.isUnsubbed = false;

    this.results = [];
    this.request = {
      targets: [
        {
          refId: 'A',
        },
      ],
    } as DataQueryRequest;

    this.ds = {
      observe: (request: DataQueryRequest) => {
        return new Observable<DataQueryResponsePacket>(subscriber => {
          this.subscriber = subscriber;
          this.wasStarted = true;

          return () => {
            console.log('unsubbed');
            this.isUnsubbed = true;
          };
        });
      },
    } as DataSourceApi;
  }

  start() {
    this.subscription = runRequest(this.ds, this.request).subscribe({
      next: (data: PanelData) => {
        console.log('got data');
        this.results.push(data);
      },
    });
  }

  emitPacket(packet: DataQueryResponsePacket) {
    console.log('emitting');
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
      ctx.setupFn();
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

  // runRequestScenario('After tree responses, 2 with different keys', ctx => {
  //   ctx.setup(() => {
  //     ctx.start();
  //     ctx.emitPacket({
  //       data: [{ name: 'DataA-1' } as DataFrame],
  //       key: 'A',
  //     });
  //     ctx.emitPacket({
  //       data: [{ name: 'DataA-2' } as DataFrame],
  //       key: 'A',
  //     });
  //     ctx.emitPacket({
  //       data: [{ name: 'DataB-1' } as DataFrame],
  //       key: 'B',
  //     });
  //   });
  //
  //   it('should emit 3 seperate results', () => {
  //     expect(ctx.results.length).toBe(3);
  //   });
  //
  //   it('should combine results and return latest data for key A', () => {
  //     expect(ctx.results[2].series).toEqual([{ name: 'DataA-2' }, { name: 'DataB-1' }]);
  //   });
  // });
});
