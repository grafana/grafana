import { CentrifugeService, CentrifugeSrvDeps } from './service';
import * as comlink from 'comlink';
import './transferHandlers';
import { remoteObservableAsObservable } from './remoteObservable';
import { LiveChannelAddress, LiveChannelConfig } from '@grafana/data';
import { LiveDataStreamOptions } from '@grafana/runtime';

let centrifuge: CentrifugeService;

const initialize = (
  deps: CentrifugeSrvDeps,
  remoteDataStreamSubscriberReadiness: comlink.RemoteObject<
    CentrifugeSrvDeps['dataStreamSubscriberReadiness'] & comlink.ProxyMarked
  >
) => {
  centrifuge = new CentrifugeService({
    ...deps,
    dataStreamSubscriberReadiness: remoteObservableAsObservable(remoteDataStreamSubscriberReadiness),
  });
};

const getConnectionState = () => {
  return comlink.proxy(centrifuge.getConnectionState());
};

const getDataStream = (options: LiveDataStreamOptions, config: LiveChannelConfig) => {
  return comlink.proxy(centrifuge.getDataStream(options, config));
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

export default class {
  constructor() {}
}
