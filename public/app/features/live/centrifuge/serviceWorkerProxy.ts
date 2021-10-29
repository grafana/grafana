import { CentrifugeSrv, CentrifugeSrvDeps } from './service';
import CentrifugeWorker from './service.worker';
import './transferHandlers';

import * as comlink from 'comlink';
import { Observable } from 'rxjs';
import { LiveChannelAddress, LiveChannelConfig, LiveChannelEvent } from '@grafana/data';

export class CentrifugeServiceWorkerProxy implements CentrifugeSrv {
  private centrifugeWorker: comlink.Remote<CentrifugeSrv> & { initialize: (deps: CentrifugeSrvDeps) => Promise<void> };

  constructor(deps: CentrifugeSrvDeps) {
    this.centrifugeWorker = comlink.wrap(new CentrifugeWorker());
    this.centrifugeWorker.initialize(deps);
  }

  getConnectionState: CentrifugeSrv['getConnectionState'] = () => {
    return this.proxyObservable(this.centrifugeWorker.getConnectionState());
  };

  getDataStream: CentrifugeSrv['getDataStream'] = (options, config) => {
    return this.proxyObservable(this.centrifugeWorker.getDataStream(options, config));
  };

  getPresence: CentrifugeSrv['getPresence'] = (address, config) => {
    return this.centrifugeWorker.getPresence(address, config);
  };

  getStream: CentrifugeSrv['getStream'] = <T>(address: LiveChannelAddress, config: LiveChannelConfig) => {
    return this.proxyObservable(
      this.centrifugeWorker.getStream(address, config) as Promise<Observable<LiveChannelEvent<T>>>
    );
  };

  private proxyObservable = <T>(promiseWithProxyObservable: Promise<Observable<T>>): Observable<T> => {
    return new Observable((subscriber) => {
      promiseWithProxyObservable.then((obs) =>
        obs.subscribe(
          comlink.proxy((nextInFake: T) => {
            subscriber.next(nextInFake);
          })
        )
      );
    });
  };
}
