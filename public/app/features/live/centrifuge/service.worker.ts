import { CentrifugeService, CentrifugeSrvDeps } from './service';
import * as comlink from 'comlink';
import './transferHandlers';
import { filter, Observable } from 'rxjs';
import { remoteObservableAsObservable } from './remoteObservable';

let centrifuge: CentrifugeService;

let okToSendData = true;

const initialize = (deps: CentrifugeSrvDeps, observable: Observable<boolean>) => {
  centrifuge = new CentrifugeService(deps);
  remoteObservableAsObservable(observable).subscribe((next) => (okToSendData = next));
};

const getConnectionState: CentrifugeService['getConnectionState'] = () => {
  return comlink.proxy(centrifuge.getConnectionState());
};

const getDataStream: CentrifugeService['getDataStream'] = (options, config) => {
  return comlink.proxy(centrifuge.getDataStream(options, config).pipe(filter(() => okToSendData)));
};

const getStream: CentrifugeService['getStream'] = (address, config) => {
  return comlink.proxy(centrifuge.getStream(address, config));
};

const getPresence: CentrifugeService['getPresence'] = async (address, config) => {
  return await centrifuge.getPresence(address, config);
};

const workObj = {
  initialize,
  getConnectionState,
  getDataStream,
  getStream,
  getPresence,
};

comlink.expose(workObj);

export default class extends Worker {
  constructor() {
    super('');
  }
}
