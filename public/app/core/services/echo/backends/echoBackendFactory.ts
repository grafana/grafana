import { EchoEvent, EchoBackendCtor, EchoBackend } from '../types';
import { getEcho } from '../EchoSrv';

export const echoBackendFactory = <O, T extends EchoEvent>(ctor: EchoBackendCtor<T, O>, opts?: O): EchoBackend<T> =>
  new ctor(getEcho(), opts);
