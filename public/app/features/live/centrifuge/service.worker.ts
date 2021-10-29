import { CentrifugeService, CentrifugeSrvDeps } from './service';
import * as comlink from 'comlink';
import './transferHandlers';

let centrifuge: CentrifugeService;
const initialize = (deps: CentrifugeSrvDeps) => {
  centrifuge = new CentrifugeService(deps);
};

const getConnectionState: CentrifugeService['getConnectionState'] = () => {
  return comlink.proxy(centrifuge.getConnectionState());
};

const getDataStream: CentrifugeService['getDataStream'] = (options, config) => {
  return comlink.proxy(centrifuge.getDataStream(options, config));
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
