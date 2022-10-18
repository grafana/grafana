import { mapValues } from 'lodash';
import { Observable, Subject, Subscription, Unsubscribable } from 'rxjs';

import {
  DataFrameJSON,
  dataFrameToJSON,
  DataQueryResponse,
  FieldType,
  LiveChannelAddress,
  LiveChannelConnectionState,
  LiveChannelEvent,
  LiveChannelEventType,
  LiveChannelLeaveEvent,
  LiveChannelScope,
  LoadingState,
} from '@grafana/data';
import { StreamingFrameAction } from '@grafana/runtime';

import { StreamingDataFrame } from '../data/StreamingDataFrame';
import { isStreamingResponseData, StreamingResponseData, StreamingResponseDataType } from '../data/utils';

import { DataStreamHandlerDeps, LiveDataStream } from './LiveDataStream';

type SubjectsInsteadOfObservables<T> = {
  [key in keyof T]: T[key] extends Observable<infer U> ? Subject<U> : T[key];
};

type DepsWithSubjectsInsteadOfObservables<T = any> = SubjectsInsteadOfObservables<DataStreamHandlerDeps<T>>;

const createDeps = <T = any>(
  overrides?: Partial<DepsWithSubjectsInsteadOfObservables<T>>
): DepsWithSubjectsInsteadOfObservables<T> => {
  return {
    channelId: 'channel-1',
    liveEventsObservable: new Subject(),
    onShutdown: jest.fn(),
    subscriberReadiness: new Subject(),
    defaultStreamingFrameOptions: { maxLength: 100, maxDelta: Infinity, action: StreamingFrameAction.Append },
    shutdownDelayInMs: 1000,
    ...(overrides ?? {}),
  };
};

class ValuesCollection<T> implements Unsubscribable {
  values: T[] = [];
  errors: any[] = [];
  receivedComplete = false;
  subscription: Subscription | undefined;

  valuesCount = () => this.values.length;

  subscribeTo = (obs: Observable<T>) => {
    if (this.subscription) {
      throw new Error(`can't subscribe twice!`);
    }

    this.subscription = obs.subscribe({
      next: (n) => {
        this.values.push(n);
      },
      error: (err) => {
        this.errors.push(err);
      },
      complete: () => {
        this.receivedComplete = true;
      },
    });
  };

  get complete() {
    return this.receivedComplete || this.subscription?.closed;
  }

  unsubscribe = () => {
    this.subscription?.unsubscribe();
  };

  lastValue = () => {
    if (!this.values.length) {
      throw new Error(`no values available in ${JSON.stringify(this)}`);
    }

    return this.values[this.values.length - 1];
  };

  lastError = () => {
    if (!this.errors.length) {
      throw new Error(`no errors available in ${JSON.stringify(this)}`);
    }

    return this.errors[this.errors.length - 1];
  };
}

const liveChannelMessageEvent = <T extends DataFrameJSON>(message: T): LiveChannelEvent<T> => ({
  type: LiveChannelEventType.Message,
  message,
});

const liveChannelLeaveEvent = (): LiveChannelLeaveEvent => ({
  type: LiveChannelEventType.Leave,
  user: '',
});

const liveChannelStatusEvent = (state: LiveChannelConnectionState, error?: Error): LiveChannelEvent => ({
  type: LiveChannelEventType.Status,
  state,
  error,
  id: '',
  timestamp: 1,
});

const fieldsOf = (data: StreamingResponseData<StreamingResponseDataType.FullFrame>) => {
  return data.frame.fields.map((f) => ({
    name: f.name,
    values: f.values,
  }));
};

const dummyErrorMessage = 'dummy-error';

describe('LiveDataStream', () => {
  jest.useFakeTimers();

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(jest.fn);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const expectValueCollectionState = <T>(
    valuesCollection: ValuesCollection<T>,
    state: { errors: number; values: number; complete: boolean }
  ) => {
    expect(valuesCollection.values).toHaveLength(state.values);
    expect(valuesCollection.errors).toHaveLength(state.errors);
    expect(valuesCollection.complete).toEqual(state.complete);
  };

  const expectResponse =
    <T extends StreamingResponseDataType>(state: LoadingState) =>
    (res: DataQueryResponse, streamingDataType: T) => {
      expect(res.state).toEqual(state);

      expect(res.data).toHaveLength(1);

      const firstData = res.data[0];
      expect(isStreamingResponseData(firstData, streamingDataType)).toEqual(true);
    };

  const expectStreamingResponse = expectResponse(LoadingState.Streaming);
  const expectErrorResponse = expectResponse(LoadingState.Error);

  const dummyLiveChannelAddress: LiveChannelAddress = {
    scope: LiveChannelScope.Grafana,
    namespace: 'stream',
    path: 'abc',
  };

  const subscriptionKey = 'subKey';

  const liveDataStreamOptions = {
    withTimeBFilter: {
      addr: dummyLiveChannelAddress,
      buffer: {
        maxLength: 2,
        maxDelta: 10,
        action: StreamingFrameAction.Append,
      },
      filter: {
        fields: ['time', 'b'],
      },
    },
    withTimeAFilter: {
      addr: dummyLiveChannelAddress,
      buffer: {
        maxLength: 3,
        maxDelta: 10,
        action: StreamingFrameAction.Append,
      },
      filter: {
        fields: ['time', 'a'],
      },
    },
    withoutFilter: {
      addr: dummyLiveChannelAddress,
      buffer: {
        maxLength: 4,
        maxDelta: 10,
        action: StreamingFrameAction.Append,
      },
    },
    withReplaceMode: {
      addr: dummyLiveChannelAddress,
      buffer: {
        maxLength: 5,
        maxDelta: 10,
        action: StreamingFrameAction.Replace,
      },
      filter: {
        fields: ['time', 'b'],
      },
    },
  };

  const dataFrameJsons = {
    schema1: () => ({
      schema: {
        fields: [
          { name: 'time', type: FieldType.time },
          { name: 'a', type: FieldType.string },
          { name: 'b', type: FieldType.number },
        ],
      },
      data: {
        values: [
          [100, 101],
          ['a', 'b'],
          [1, 2],
        ],
      },
    }),
    schema1newValues: () => ({
      data: {
        values: [[102], ['c'], [3]],
      },
    }),
    schema1newValues2: () => ({
      data: {
        values: [[103], ['d'], [4]],
      },
    }),
    schema2: () => ({
      schema: {
        fields: [
          { name: 'time', type: FieldType.time },
          { name: 'a', type: FieldType.string },
          { name: 'b', type: FieldType.string },
        ],
      },
      data: {
        values: [[103], ['x'], ['y']],
      },
    }),
    schema2newValues: () => ({
      data: {
        values: [[104], ['w'], ['o']],
      },
    }),
  };

  describe('happy path with a single subscriber in `append` mode', () => {
    let deps: ReturnType<typeof createDeps>;
    let liveDataStream: LiveDataStream<any>;
    const valuesCollection = new ValuesCollection<DataQueryResponse>();

    beforeAll(() => {
      deps = createDeps();

      expect(deps.liveEventsObservable.observed).toBeFalsy();
      expect(deps.subscriberReadiness.observed).toBeFalsy();
      liveDataStream = new LiveDataStream(deps);
    });

    it('should subscribe to live events observable immediately after creation', async () => {
      expect(deps.liveEventsObservable.observed).toBeTruthy();
    });

    it('should not subscribe to subscriberReadiness observable until first subscription', async () => {
      expect(deps.subscriberReadiness.observed).toBeFalsy();
    });

    it('should subscribe to subscriberReadiness observable on first subscription and return observable without any values', async () => {
      const observable = liveDataStream.get(liveDataStreamOptions.withTimeBFilter, subscriptionKey);
      valuesCollection.subscribeTo(observable);

      //then
      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expectValueCollectionState(valuesCollection, { errors: 0, values: 0, complete: false });
    });

    it('should emit the first live channel message event as a serialized streamingDataFrame', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1()));

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });
      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.FullFrame);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.FullFrame>;

      expect(data.frame.options).toEqual(liveDataStreamOptions.withTimeBFilter.buffer);

      const deserializedFrame = StreamingDataFrame.deserialize(data.frame);
      expect(deserializedFrame.fields).toEqual([
        {
          config: {},
          name: 'time',
          type: 'time',
          values: {
            buffer: [100, 101],
          },
        },
        {
          config: {},
          name: 'b',
          type: 'number',
          values: {
            buffer: [1, 2],
          },
        },
      ]);
      expect(deserializedFrame.length).toEqual(dataFrameJsons.schema1().data.values[0].length);
    });

    it('should emit subsequent messages as deltas if the schema stays the same', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });
      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.NewValuesSameSchema);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.NewValuesSameSchema>;

      expect(data.values).toEqual([[102], [3]]);
    });

    it('should emit a full frame if schema changes', async () => {
      const valuesCount = valuesCollection.valuesCount();
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2()));

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });
      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.FullFrame);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.FullFrame>;

      expect(fieldsOf(data)).toEqual([
        {
          name: 'time',
          values: [102, 103],
        },
        {
          name: 'b',
          values: [undefined, 'y'], //  bug in streamingDataFrame - fix!
        },
      ]);
      expect(StreamingDataFrame.deserialize(data.frame).length).toEqual(2);
    });

    it('should emit a full frame if received a status live channel event with error', async () => {
      const valuesCount = valuesCollection.valuesCount();

      const error = new Error(`oh no!`);
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Connected, error));

      expectValueCollectionState(valuesCollection, {
        errors: 0,
        values: valuesCount + 1,
        complete: false,
      });
      const response = valuesCollection.lastValue();

      expectErrorResponse(response, StreamingResponseDataType.FullFrame);
      expect(StreamingDataFrame.deserialize(response.data[0].frame).length).toEqual(2); // contains previously populated values
    });

    it('should buffer new values until subscriber is ready', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.subscriberReadiness.next(false);
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.subscriberReadiness.next(true);
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });

      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.NewValuesSameSchema);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.NewValuesSameSchema>;

      expect(data.values).toEqual([
        [104, 104, 104],
        ['o', 'o', 'o'],
      ]);
    });

    it(`should reduce buffer to a full frame if schema changed at any point during subscriber's unavailability`, async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.subscriberReadiness.next(false);

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.subscriberReadiness.next(true);
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });

      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.FullFrame);
      expect(fieldsOf(response.data[0])).toEqual([
        {
          name: 'time',
          values: [101, 102],
        },
        {
          name: 'b',
          values: [2, 3],
        },
      ]);
      expect(StreamingDataFrame.deserialize(response.data[0].frame).length).toEqual(2);
    });

    it(`should reduce buffer to a full frame with last error if one or more errors occur during subscriber's unavailability`, async () => {
      const firstError = new Error('first error');
      const secondError = new Error(dummyErrorMessage);
      const valuesCount = valuesCollection.valuesCount();

      deps.subscriberReadiness.next(false);

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Connected, firstError));
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Connected, secondError));

      deps.subscriberReadiness.next(true);
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });

      const response = valuesCollection.lastValue();
      expectErrorResponse(response, StreamingResponseDataType.FullFrame);

      const errorMessage = response?.error?.message;
      expect(errorMessage?.includes(dummyErrorMessage)).toBeTruthy();

      expect(fieldsOf(response.data[0])).toEqual([
        {
          name: 'time',
          values: [102, 102],
        },
        {
          name: 'b',
          values: [3, 3],
        },
      ]);
    });

    it('should ignore messages without payload', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Connected));
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Pending));
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Pending));
      deps.liveEventsObservable.next(liveChannelLeaveEvent());

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });
    });

    it(`should shutdown when source observable completes`, async () => {
      expect(deps.onShutdown).not.toHaveBeenCalled();
      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expect(deps.liveEventsObservable.observed).toBeTruthy();

      deps.liveEventsObservable.complete();
      expectValueCollectionState(valuesCollection, {
        errors: 0,
        values: valuesCollection.valuesCount(),
        complete: true,
      });

      expect(deps.subscriberReadiness.observed).toBeFalsy();
      expect(deps.liveEventsObservable.observed).toBeFalsy();
      expect(deps.onShutdown).toHaveBeenCalled();
    });
  });

  describe('happy path with a single subscriber in `replace` mode', () => {
    let deps: ReturnType<typeof createDeps>;
    let liveDataStream: LiveDataStream<any>;
    const valuesCollection = new ValuesCollection<DataQueryResponse>();

    beforeAll(() => {
      deps = createDeps();

      expect(deps.liveEventsObservable.observed).toBeFalsy();
      expect(deps.subscriberReadiness.observed).toBeFalsy();
      liveDataStream = new LiveDataStream(deps);
      valuesCollection.subscribeTo(liveDataStream.get(liveDataStreamOptions.withReplaceMode, subscriptionKey));
    });

    it('should emit the first live channel message event as a serialized streamingDataFrame', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1()));

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });
      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.FullFrame);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.FullFrame>;

      expect(data.frame.options).toEqual(liveDataStreamOptions.withReplaceMode.buffer);

      const deserializedFrame = StreamingDataFrame.deserialize(data.frame);
      expect(deserializedFrame.fields).toEqual([
        {
          config: {},
          name: 'time',
          type: 'time',
          values: {
            buffer: [100, 101],
          },
        },
        {
          config: {},
          name: 'b',
          type: 'number',
          values: {
            buffer: [1, 2],
          },
        },
      ]);
      expect(deserializedFrame.length).toEqual(dataFrameJsons.schema1().data.values[0].length);
    });

    it('should emit subsequent messages as deltas if the schema stays the same', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });
      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.NewValuesSameSchema);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.NewValuesSameSchema>;

      expect(data.values).toEqual([[102], [3]]);
    });

    it('should emit a full frame if schema changes', async () => {
      const valuesCount = valuesCollection.valuesCount();
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2()));

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });
      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.FullFrame);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.FullFrame>;

      expect(fieldsOf(data)).toEqual([
        {
          name: 'time',
          values: [103],
        },
        {
          name: 'b',
          values: ['y'],
        },
      ]);
      const deserializedFrame = StreamingDataFrame.deserialize(data.frame);
      expect(deserializedFrame.length).toEqual(1);
    });

    it('should emit a full frame if received a status live channel event with error', async () => {
      const valuesCount = valuesCollection.valuesCount();

      const error = new Error(`oh no!`);
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Connected, error));

      expectValueCollectionState(valuesCollection, {
        errors: 0,
        values: valuesCount + 1,
        complete: false,
      });
      const response = valuesCollection.lastValue();

      expectErrorResponse(response, StreamingResponseDataType.FullFrame);
      expect(StreamingDataFrame.deserialize(response.data[0].frame).length).toEqual(0);
    });

    it('should buffer new values until subscriber is ready', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.subscriberReadiness.next(false);
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.subscriberReadiness.next(true);
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });

      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.NewValuesSameSchema);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.NewValuesSameSchema>;

      expect(data.values).toEqual([[104], ['o']]);
    });

    it(`should reduce buffer to a full frame if schema changed at any point during subscriber's unavailability`, async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.subscriberReadiness.next(false);

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema2newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });

      deps.subscriberReadiness.next(true);
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });

      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.FullFrame);
      expect(fieldsOf(response.data[0])).toEqual([
        {
          name: 'time',
          values: [102],
        },
        {
          name: 'b',
          values: [3],
        },
      ]);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.FullFrame>;
      expect(StreamingDataFrame.deserialize(data.frame).length).toEqual(1);
    });

    it(`should reduce buffer to an empty full frame with last error if one or more errors occur during subscriber's unavailability`, async () => {
      const firstError = new Error('first error');
      const secondError = new Error(dummyErrorMessage);
      const valuesCount = valuesCollection.valuesCount();

      deps.subscriberReadiness.next(false);

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Connected, firstError));
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Connected, secondError));

      deps.subscriberReadiness.next(true);
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });

      const response = valuesCollection.lastValue();
      expectErrorResponse(response, StreamingResponseDataType.FullFrame);

      const errorMessage = response?.error?.message;
      expect(errorMessage?.includes(dummyErrorMessage)).toBeTruthy();

      expect(fieldsOf(response.data[0])).toEqual([
        {
          name: 'time',
          values: [],
        },
        {
          name: 'b',
          values: [],
        },
      ]);
      expect(StreamingDataFrame.deserialize(response.data[0].frame).length).toEqual(0);
    });

    it('should ignore messages without payload', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Connected));
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Pending));
      deps.liveEventsObservable.next(liveChannelStatusEvent(LiveChannelConnectionState.Pending));
      deps.liveEventsObservable.next(liveChannelLeaveEvent());

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount, complete: false });
    });

    it(`should shutdown when source observable completes`, async () => {
      expect(deps.onShutdown).not.toHaveBeenCalled();
      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expect(deps.liveEventsObservable.observed).toBeTruthy();

      deps.liveEventsObservable.complete();
      expectValueCollectionState(valuesCollection, {
        errors: 0,
        values: valuesCollection.valuesCount(),
        complete: true,
      });

      expect(deps.subscriberReadiness.observed).toBeFalsy();
      expect(deps.liveEventsObservable.observed).toBeFalsy();
      expect(deps.onShutdown).toHaveBeenCalled();
    });
  });

  describe('single subscriber with initial frame', () => {
    it('should emit the initial frame right after subscribe', async () => {
      const deps = createDeps();
      const liveDataStream = new LiveDataStream(deps);
      const valuesCollection = new ValuesCollection<DataQueryResponse>();

      const initialFrame = dataFrameJsons.schema2();
      const observable = liveDataStream.get(
        { ...liveDataStreamOptions.withTimeBFilter, frame: initialFrame },
        subscriptionKey
      );
      valuesCollection.subscribeTo(observable);

      //then
      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expectValueCollectionState(valuesCollection, { errors: 0, values: 1, complete: false });

      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.FullFrame);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.FullFrame>;

      expect(fieldsOf(data)).toEqual([
        {
          name: 'time',
          values: [103],
        },
        {
          name: 'b',
          values: ['y'], //  bug in streamingDataFrame - fix!
        },
      ]);
      expect(StreamingDataFrame.deserialize(response.data[0].frame).length).toEqual(1);
    });
  });

  describe('two subscribers with initial frames', () => {
    it('should ignore initial frame from second subscriber', async () => {
      const deps = createDeps();
      const liveDataStream = new LiveDataStream(deps);
      const valuesCollection = new ValuesCollection<DataQueryResponse>();
      const valuesCollection2 = new ValuesCollection<DataQueryResponse>();

      valuesCollection.subscribeTo(
        liveDataStream.get(
          {
            ...liveDataStreamOptions.withTimeBFilter,
            frame: dataFrameToJSON(StreamingDataFrame.fromDataFrameJSON(dataFrameJsons.schema1())),
          },
          subscriptionKey
        )
      );

      expectValueCollectionState(valuesCollection, { errors: 0, values: 1, complete: false });

      valuesCollection2.subscribeTo(
        liveDataStream.get(
          {
            ...liveDataStreamOptions.withTimeBFilter,
            frame: dataFrameJsons.schema2(),
          },
          subscriptionKey
        )
      );
      // no extra emits for initial subscriber
      expectValueCollectionState(valuesCollection, { errors: 0, values: 1, complete: false });
      expectValueCollectionState(valuesCollection2, { errors: 0, values: 1, complete: false });

      const frame1 = fieldsOf(valuesCollection.lastValue().data[0]);
      const frame2 = fieldsOf(valuesCollection2.lastValue().data[0]);
      expect(frame1).toEqual(frame2);
    });
  });

  describe('source observable emits completed event', () => {
    it('should shutdown', async () => {
      const deps = createDeps();
      const liveDataStream = new LiveDataStream(deps);
      const valuesCollection = new ValuesCollection<DataQueryResponse>();

      const observable = liveDataStream.get(liveDataStreamOptions.withTimeAFilter, subscriptionKey);
      valuesCollection.subscribeTo(observable);

      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expect(deps.liveEventsObservable.observed).toBeTruthy();
      expect(deps.onShutdown).not.toHaveBeenCalled();

      deps.liveEventsObservable.complete();

      expectValueCollectionState(valuesCollection, {
        errors: 0,
        values: 0,
        complete: true,
      });
      expect(deps.subscriberReadiness.observed).toBeFalsy();
      expect(deps.liveEventsObservable.observed).toBeFalsy();
      expect(deps.onShutdown).toHaveBeenCalled();
    });
  });

  describe('source observable emits error event', () => {
    it('should shutdown', async () => {
      const deps = createDeps();
      const liveDataStream = new LiveDataStream(deps);
      const valuesCollection = new ValuesCollection<DataQueryResponse>();

      const observable = liveDataStream.get(liveDataStreamOptions.withTimeAFilter, subscriptionKey);
      valuesCollection.subscribeTo(observable);

      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expect(deps.liveEventsObservable.observed).toBeTruthy();
      expect(deps.onShutdown).not.toHaveBeenCalled();

      deps.liveEventsObservable.error(new Error(dummyErrorMessage));

      expectValueCollectionState(valuesCollection, {
        errors: 0,
        values: 1,
        complete: true,
      });
      const response = valuesCollection.lastValue();
      expectErrorResponse(response, StreamingResponseDataType.FullFrame);

      expect(response?.error?.message?.includes(dummyErrorMessage)).toBeTruthy();

      expect(deps.subscriberReadiness.observed).toBeFalsy();
      expect(deps.liveEventsObservable.observed).toBeFalsy();
      expect(deps.onShutdown).toHaveBeenCalled();
    });
  });

  describe('happy path with multiple subscribers', () => {
    let deps: ReturnType<typeof createDeps>;
    let liveDataStream: LiveDataStream<any>;
    const valuesCollections = {
      withTimeBFilter: new ValuesCollection<DataQueryResponse>(),
      withTimeAFilter: new ValuesCollection<DataQueryResponse>(),
      withoutFilter: new ValuesCollection<DataQueryResponse>(),
      withReplaceMode: new ValuesCollection<DataQueryResponse>(),
    };

    beforeAll(() => {
      deps = createDeps();
      liveDataStream = new LiveDataStream(deps);
    });

    it('should emit the last value as full frame to new subscribers', async () => {
      valuesCollections.withTimeAFilter.subscribeTo(
        liveDataStream.get(liveDataStreamOptions.withTimeAFilter, subscriptionKey)
      );

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1()));
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));

      expectValueCollectionState(valuesCollections.withTimeAFilter, { errors: 0, values: 2, complete: false });

      valuesCollections.withTimeBFilter.subscribeTo(
        liveDataStream.get(liveDataStreamOptions.withTimeBFilter, subscriptionKey)
      );
      valuesCollections.withoutFilter.subscribeTo(
        liveDataStream.get(liveDataStreamOptions.withoutFilter, subscriptionKey)
      );
      valuesCollections.withReplaceMode.subscribeTo(
        liveDataStream.get(liveDataStreamOptions.withReplaceMode, subscriptionKey)
      );

      expectValueCollectionState(valuesCollections.withTimeAFilter, { errors: 0, values: 2, complete: false });
      expectValueCollectionState(valuesCollections.withTimeBFilter, { errors: 0, values: 1, complete: false });
      expectValueCollectionState(valuesCollections.withoutFilter, { errors: 0, values: 1, complete: false });
      expectValueCollectionState(valuesCollections.withReplaceMode, { errors: 0, values: 1, complete: false });
    });

    it('should emit filtered data to each subscriber', async () => {
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues2()));
      expect(
        mapValues(valuesCollections, (collection) =>
          collection.values.map((response) => {
            const data = response.data[0];
            return isStreamingResponseData(data, StreamingResponseDataType.FullFrame)
              ? fieldsOf(data)
              : isStreamingResponseData(data, StreamingResponseDataType.NewValuesSameSchema)
              ? data.values
              : response;
          })
        )
      ).toEqual({
        withTimeAFilter: [
          [
            {
              name: 'time',
              values: [100, 101],
            },
            {
              name: 'a',
              values: ['a', 'b'],
            },
          ],
          [[102], ['c']],
          [[103], ['d']],
        ],
        withTimeBFilter: [
          [
            {
              name: 'time',
              values: [101, 102],
            },
            {
              name: 'b',
              values: [2, 3],
            },
          ],
          [[103], [4]],
        ],
        withoutFilter: [
          [
            {
              name: 'time',
              values: [100, 101, 102],
            },
            {
              name: 'a',
              values: ['a', 'b', 'c'],
            },
            {
              name: 'b',
              values: [1, 2, 3],
            },
          ],
          [[103], ['d'], [4]],
        ],
        withReplaceMode: [
          // only last packet
          [
            {
              name: 'time',
              values: [102],
            },
            {
              name: 'b',
              values: [3],
            },
          ],
          [[103], [4]],
        ],
      });
    });

    it('should not unsubscribe the source observable unless all subscribers unsubscribe', async () => {
      valuesCollections.withTimeAFilter.unsubscribe();
      jest.advanceTimersByTime(deps.shutdownDelayInMs + 1);

      expect(mapValues(valuesCollections, (coll) => coll.complete)).toEqual({
        withTimeAFilter: true,
        withTimeBFilter: false,
        withoutFilter: false,
        withReplaceMode: false,
      });
      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expect(deps.liveEventsObservable.observed).toBeTruthy();
      expect(deps.onShutdown).not.toHaveBeenCalled();
    });

    it('should emit complete event to all subscribers during shutdown', async () => {
      deps.liveEventsObservable.complete();

      expect(mapValues(valuesCollections, (coll) => coll.complete)).toEqual({
        withTimeAFilter: true,
        withTimeBFilter: true,
        withoutFilter: true,
        withReplaceMode: true,
      });
      expect(deps.subscriberReadiness.observed).toBeFalsy();
      expect(deps.liveEventsObservable.observed).toBeFalsy();
      expect(deps.onShutdown).toHaveBeenCalled();
    });
  });

  describe('shutdown after unsubscribe', () => {
    it('should shutdown if no other subscriber subscribed during shutdown delay', async () => {
      const deps = createDeps();
      const liveDataStream = new LiveDataStream(deps);
      const valuesCollection = new ValuesCollection<DataQueryResponse>();

      valuesCollection.subscribeTo(liveDataStream.get(liveDataStreamOptions.withTimeAFilter, subscriptionKey));

      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expect(deps.liveEventsObservable.observed).toBeTruthy();
      expect(deps.onShutdown).not.toHaveBeenCalled();

      valuesCollection.unsubscribe();
      jest.advanceTimersByTime(deps.shutdownDelayInMs - 1);

      // delay not finished - should still be subscribed
      expect(deps.subscriberReadiness.observed).toBeFalsy();
      expect(deps.liveEventsObservable.observed).toBeTruthy();
      expect(deps.onShutdown).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2);

      // delay not finished - shut still be subscribed
      expect(deps.subscriberReadiness.observed).toBeFalsy();
      expect(deps.liveEventsObservable.observed).toBeFalsy();
      expect(deps.onShutdown).toHaveBeenCalled();
    });

    it('should not shutdown after unsubscribe if another subscriber subscribes during shutdown delay', async () => {
      const deps = createDeps();
      const liveDataStream = new LiveDataStream(deps);
      const valuesCollection1 = new ValuesCollection<DataQueryResponse>();
      const valuesCollection2 = new ValuesCollection<DataQueryResponse>();

      valuesCollection1.subscribeTo(liveDataStream.get(liveDataStreamOptions.withTimeAFilter, subscriptionKey));

      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expect(deps.liveEventsObservable.observed).toBeTruthy();
      expect(deps.onShutdown).not.toHaveBeenCalled();

      valuesCollection1.unsubscribe();
      jest.advanceTimersByTime(deps.shutdownDelayInMs - 1);

      valuesCollection2.subscribeTo(liveDataStream.get(liveDataStreamOptions.withTimeAFilter, subscriptionKey));
      jest.advanceTimersByTime(deps.shutdownDelayInMs);

      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expect(deps.liveEventsObservable.observed).toBeTruthy();
      expect(deps.onShutdown).not.toHaveBeenCalled();
    });
  });
});
