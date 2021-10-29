import { CentrifugeSrv, CentrifugeSrvDeps } from './service';
import CentrifugeWorker from './service.worker';
import './transferHandlers';

import * as comlink from 'comlink';
import { Observable } from 'rxjs';
import { LiveChannelAddress, LiveChannelConfig, LiveChannelEvent } from '@grafana/data';
import { liveTimer } from 'app/features/dashboard/dashgrid/liveTimer';
import { promiseWithRemoteObservableAsObservable } from './remoteObservable';

export class CentrifugeServiceWorkerProxy implements CentrifugeSrv {
  private centrifugeWorker: comlink.Remote<CentrifugeSrv> & {
    initialize: (deps: CentrifugeSrvDeps, liveTimerObservable: Observable<boolean>) => Promise<void>;
  };

  constructor(deps: CentrifugeSrvDeps) {
    this.centrifugeWorker = comlink.wrap(new CentrifugeWorker());
    this.centrifugeWorker.initialize(deps, comlink.proxy(liveTimer.ok));
  }

  getConnectionState: CentrifugeSrv['getConnectionState'] = () => {
    return promiseWithRemoteObservableAsObservable(this.centrifugeWorker.getConnectionState());
  };

  getDataStream: CentrifugeSrv['getDataStream'] = (options, config) => {
    return promiseWithRemoteObservableAsObservable(this.centrifugeWorker.getDataStream(options, config));
  };

  getPresence: CentrifugeSrv['getPresence'] = (address, config) => {
    return this.centrifugeWorker.getPresence(address, config);
  };

  getStream: CentrifugeSrv['getStream'] = <T>(address: LiveChannelAddress, config: LiveChannelConfig) => {
    return promiseWithRemoteObservableAsObservable(
      this.centrifugeWorker.getStream(address, config) as Promise<Observable<LiveChannelEvent<T>>>
    );
  };
}
