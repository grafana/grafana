import { CentrifugeService, CentrifugeSrvDeps } from './service';
import * as comlink from 'comlink';
import './transferHandlers';
import { filter, Observable } from 'rxjs';
import { remoteObservableAsObservable } from './remoteObservable';
import { LiveChannelAddress, LiveChannelConfig } from '@grafana/data';
import { LiveDataStreamOptions } from '@grafana/runtime';

let centrifuge: CentrifugeService;

let okToSendData = true;

const initialize = (
  deps: CentrifugeSrvDeps,
  remoteObservable: comlink.RemoteObject<Observable<boolean> & comlink.ProxyMarked>
) => {
  centrifuge = new CentrifugeService(deps);
  remoteObservableAsObservable(remoteObservable).subscribe((next) => (okToSendData = next));
};

const getConnectionState = () => {
  return comlink.proxy(centrifuge.getConnectionState());
};

const getDataStream = (options: LiveDataStreamOptions, config: LiveChannelConfig) => {
  return comlink.proxy(centrifuge.getDataStream(options, config).pipe(filter(() => okToSendData)));
};

const getStream = (address: LiveChannelAddress, config: LiveChannelConfig) => {
  return comlink.proxy(centrifuge.getStream(address, config));
};

const getPresence = async (address: LiveChannelAddress, config: LiveChannelConfig) => {
  return await centrifuge.getPresence(address, config);
};

const workObj = {
  initialize,
  getConnectionState,
  getDataStream,
  getStream,
  getPresence,
};

export type RemoteCentrifugeService = typeof workObj;

comlink.expose(workObj);

export default class extends Worker {
  constructor() {
    super('');
  }
}
