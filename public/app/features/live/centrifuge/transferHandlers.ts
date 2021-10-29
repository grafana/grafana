import { ArrayVector, LoadingState, StreamingDataFrame } from '@grafana/data';
import * as comlink from 'comlink';

const streamingDataFrameHandler: any = {
  canHandle: (v: unknown) => {
    const isArray = Array.isArray(v) && v.length > 0;
    const isStreamingEvent = isArray && v[0].state === LoadingState.Streaming;

    return isArray && isStreamingEvent;
  },
  serialize: (value: { state: LoadingState; data: [StreamingDataFrame]; key: string }) => {
    return [value, []];
  },

  deserialize: (value: [{ state: LoadingState; data: [StreamingDataFrame]; key: string }]) => {
    const event: { state: string; data: [StreamingDataFrame]; key: string } = value[0];

    const frame = event.data[0];
    frame.fields = frame.fields.map((field) => ({ ...field, values: new ArrayVector<any>(field.values.buffer) }));
    return value;
  },
};

comlink.transferHandlers.set('StreamingDataFrameHandler', streamingDataFrameHandler);

const subscriberTransferHandler: any = {
  canHandle(value: any): boolean {
    return value?.constructor?.name === 'SafeSubscriber';
  },

  serialize(value: Function): [MessagePort, Transferable[]] {
    const obj = comlink.proxy(value);

    const { port1, port2 } = new MessageChannel();

    comlink.expose(obj, port1);

    return [port2, [port2]];
  },

  deserialize(value: MessagePort): comlink.Remote<MessagePort> {
    value.start();

    return comlink.wrap<MessagePort>(value);
  },
};
comlink.transferHandlers.set('SubscriberHandler', subscriberTransferHandler);
