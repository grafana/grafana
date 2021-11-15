import {
  DataFrameJSON,
  DataQueryResponse,
  FieldType,
  LiveChannelAddress,
  LiveChannelConnectionState,
  LiveChannelEvent,
  LiveChannelEventType,
  LiveChannelScope,
  LoadingState,
  StreamingDataFrame,
  StreamingFrameAction,
} from '@grafana/data';
import { Observable, Subject, Subscription, Unsubscribable } from 'rxjs';
import { DataStreamHandlerDeps, LiveDataStream } from './LiveDataStream';
import {
  isStreamingResponseData,
  StreamingResponseData,
  StreamingResponseDataType,
} from '@grafana/data/src/dataframe/StreamingDataFrame';

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
  complete = false;
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
        this.complete = true;
      },
    });
  };

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

const statusLiveChannelEvent = (state: LiveChannelConnectionState, error?: Error): LiveChannelEvent => ({
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

describe('LiveDataStream', () => {
  const expectValueCollectionState = <T>(
    valuesCollection: ValuesCollection<T>,
    state: { errors: number; values: number; complete: boolean }
  ) => {
    expect(valuesCollection.values).toHaveLength(state.values);
    expect(valuesCollection.errors).toHaveLength(state.errors);
    expect(valuesCollection.complete).toEqual(state.complete);
  };

  const expectResponse = <T extends StreamingResponseDataType>(state: LoadingState) => (
    res: DataQueryResponse,
    streamingDataType: T
  ) => {
    expect(res.state).toEqual(state);

    expect(res.data).toHaveLength(1);

    const firstData = res.data[0];
    expect(isStreamingResponseData(firstData, streamingDataType)).toEqual(true);
  };

  const expectStreamingResponse = expectResponse(LoadingState.Streaming);
  const expectErrorResponse = expectResponse(LoadingState.Error);

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

  const dummyLiveChannelAddress: LiveChannelAddress = {
    scope: LiveChannelScope.Grafana,
    namespace: 'stream',
    path: 'abc',
  };

  describe('happy path with a single subscriber', () => {
    const subscriberStreamingOptions = {
      maxLength: 2,
      maxDelta: 10,
      action: StreamingFrameAction.Append,
    };
    let deps: ReturnType<typeof createDeps>;
    let liveDataStream: LiveDataStream<any>;
    let observable: Observable<DataQueryResponse>;
    let valuesCollection = new ValuesCollection<DataQueryResponse>();

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
      observable = liveDataStream.get(
        {
          addr: dummyLiveChannelAddress,
          buffer: subscriberStreamingOptions,
          filter: {
            fields: ['time', 'b'],
          },
        },
        'subey'
      );
      valuesCollection.subscribeTo(observable);

      //then
      expect(deps.subscriberReadiness.observed).toBeTruthy();
      expectValueCollectionState(valuesCollection, { errors: 0, values: 0, complete: false });
    });

    it('should push the first live channel message event to the subscriber as a serialized streamingDataFrame', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1()));

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });
      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.FullFrame);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.FullFrame>;

      expect(data.frame.options).toEqual(subscriberStreamingOptions);

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

    it('should push subsequent messages as deltas if the schema stays the same', async () => {
      const valuesCount = valuesCollection.valuesCount();

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));

      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });
      const response = valuesCollection.lastValue();

      expectStreamingResponse(response, StreamingResponseDataType.NewValuesSameSchema);
      const data = response.data[0] as StreamingResponseData<StreamingResponseDataType.NewValuesSameSchema>;

      expect(data.values).toEqual([[102], [3]]);
    });

    it('should push a full frame if schema changes', async () => {
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
          values: [], //  bug in streamingDataFrame - fix!
        },
      ]);
    });

    it('should push a full frame if received a status live channel event with error', async () => {
      const valuesCount = valuesCollection.valuesCount();

      const error = new Error(`oh no!`);
      deps.liveEventsObservable.next(statusLiveChannelEvent(LiveChannelConnectionState.Connected, error));

      expectValueCollectionState(valuesCollection, {
        errors: 0,
        values: valuesCount + 1,
        complete: false,
      });
      const response = valuesCollection.lastValue();

      expectErrorResponse(response, StreamingResponseDataType.FullFrame);
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
          values: [],
        },
      ]);
    });

    it(`should reduce buffer to a full frame with last error if one or more errors occur during subscriber's unavailability`, async () => {
      const firstError = new Error('first error');
      const secondErrorMessage = 'second error - unit test';
      const secondError = new Error(secondErrorMessage);
      const valuesCount = valuesCollection.valuesCount();

      deps.subscriberReadiness.next(false);

      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      deps.liveEventsObservable.next(statusLiveChannelEvent(LiveChannelConnectionState.Connected, firstError));
      deps.liveEventsObservable.next(liveChannelMessageEvent(dataFrameJsons.schema1newValues()));
      deps.liveEventsObservable.next(statusLiveChannelEvent(LiveChannelConnectionState.Connected, secondError));

      deps.subscriberReadiness.next(true);
      expectValueCollectionState(valuesCollection, { errors: 0, values: valuesCount + 1, complete: false });

      const response = valuesCollection.lastValue();
      expectErrorResponse(response, StreamingResponseDataType.FullFrame);

      const errorMessage = response?.error?.message;
      expect(errorMessage?.includes(secondErrorMessage)).toBeTruthy();

      expect(fieldsOf(response.data[0])).toEqual([
        {
          name: 'time',
          values: [102, 102],
        },
        {
          name: 'b',
          values: [],
        },
      ]);
    });
  });
});
