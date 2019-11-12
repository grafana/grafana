import { EchoEvent, EchoConsumerCtor, EchoConsumer } from './types';
import { getEcho } from './EchoSrv';

export const echoConsumerFactory = <O, T extends EchoEvent>(ctor: EchoConsumerCtor<T, O>, opts: O): EchoConsumer<T> =>
  new ctor(getEcho(), opts);
