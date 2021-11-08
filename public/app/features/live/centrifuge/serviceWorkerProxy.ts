import { CentrifugeSrv, CentrifugeSrvDeps } from './service';
import { RemoteCentrifugeService } from './service.worker';
import './transferHandlers';

import * as comlink from 'comlink';
import { asyncScheduler, Observable, observeOn } from 'rxjs';
import { LiveChannelAddress, LiveChannelConfig, LiveChannelEvent } from '@grafana/data';
import { promiseWithRemoteObservableAsObservable } from './remoteObservable';
import { createWorker } from './createCentrifugeServiceWorker';

export class CentrifugeServiceWorkerProxy implements CentrifugeSrv {
  private centrifugeWorker;

  constructor(deps: CentrifugeSrvDeps) {
    this.centrifugeWorker = comlink.wrap<RemoteCentrifugeService>(createWorker() as comlink.Endpoint);
    this.centrifugeWorker.initialize(deps, comlink.proxy(deps.dataStreamSubscriberReadiness));
  }

  getConnectionState: CentrifugeSrv['getConnectionState'] = () => {
    return promiseWithRemoteObservableAsObservable(this.centrifugeWorker.getConnectionState());
  };

  getDataStream: CentrifugeSrv['getDataStream'] = (options, config) => {
    return promiseWithRemoteObservableAsObservable(this.centrifugeWorker.getDataStream(options, config)).pipe(
      // async scheduler splits the synchronous task of deserializing data from web worker and
      // consuming the message (ie. updating react component) into two to avoid blocking the event loop
      observeOn(asyncScheduler)
    );
  };

  getPresence: CentrifugeSrv['getPresence'] = (address, config) => {
    return this.centrifugeWorker.getPresence(address, config);
  };

  getStream: CentrifugeSrv['getStream'] = <T>(address: LiveChannelAddress, config: LiveChannelConfig) => {
    return promiseWithRemoteObservableAsObservable(
      this.centrifugeWorker.getStream(address, config) as Promise<comlink.Remote<Observable<LiveChannelEvent<T>>>>
    );
  };
}
