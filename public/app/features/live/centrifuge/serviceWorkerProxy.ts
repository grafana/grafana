import './transferHandlers';

import * as comlink from 'comlink';
import { asyncScheduler, Observable, observeOn } from 'rxjs';

import { LiveChannelAddress, LiveChannelEvent } from '@grafana/data';

import { createWorker } from './createCentrifugeServiceWorker';
import { promiseWithRemoteObservableAsObservable } from './remoteObservable';
import { CentrifugeSrv, CentrifugeSrvDeps } from './service';
import { RemoteCentrifugeService } from './service.worker';

export class CentrifugeServiceWorkerProxy implements CentrifugeSrv {
  private centrifugeWorker;

  constructor(deps: CentrifugeSrvDeps) {
    this.centrifugeWorker = comlink.wrap<RemoteCentrifugeService>(createWorker() as comlink.Endpoint);
    this.centrifugeWorker.initialize(deps, comlink.proxy(deps.dataStreamSubscriberReadiness));
  }

  getConnectionState: CentrifugeSrv['getConnectionState'] = () => {
    return promiseWithRemoteObservableAsObservable(this.centrifugeWorker.getConnectionState());
  };

  getDataStream: CentrifugeSrv['getDataStream'] = (options) => {
    return promiseWithRemoteObservableAsObservable(this.centrifugeWorker.getDataStream(options)).pipe(
      // async scheduler splits the synchronous task of deserializing data from web worker and
      // consuming the message (ie. updating react component) into two to avoid blocking the event loop
      observeOn(asyncScheduler)
    );
  };

  /**
   * Query over websocket
   */
  getQueryData: CentrifugeSrv['getQueryData'] = async (options) => {
    const optionsAsPlainSerializableObject = JSON.parse(JSON.stringify(options));
    return this.centrifugeWorker.getQueryData(optionsAsPlainSerializableObject);
  };

  getPresence: CentrifugeSrv['getPresence'] = (address) => {
    return this.centrifugeWorker.getPresence(address);
  };

  getStream: CentrifugeSrv['getStream'] = <T>(address: LiveChannelAddress) => {
    return promiseWithRemoteObservableAsObservable(
      this.centrifugeWorker.getStream(address) as Promise<comlink.Remote<Observable<LiveChannelEvent<T>>>>
    );
  };
}
