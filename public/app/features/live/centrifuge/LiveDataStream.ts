import { map, Observable, Subject, type Subscriber, type Subscription } from 'rxjs';

import {
  type DataFrameJSON,
  type DataQueryError,
  type Field,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  LiveChannelConnectionState,
  type LiveChannelEvent,
  type LiveChannelId,
  LoadingState,
  StreamingDataFrame,
} from '@grafana/data';
import { getStreamingFrameOptions } from '@grafana/data/internal';
import {
  type LiveDataStreamOptions,
  StreamingFrameAction,
  type StreamingFrameOptions,
  toDataQueryError,
} from '@grafana/runtime';

import { StreamingResponseDataType } from '../data/utils';

import { type DataStreamSubscriptionKey, type StreamingDataQueryResponse } from './service';

const bufferIfNot =
  (canEmitObservable: Observable<boolean>) =>
  <T>(source: Observable<T>): Observable<T[]> => {
    return new Observable((subscriber: Subscriber<T[]>) => {
      let buffer: T[] = [];
      let canEmit = true;

      const emitBuffer = () => {
        subscriber.next(buffer);
        buffer = [];
      };

      const canEmitSub = canEmitObservable.subscribe({
        next: (val) => {
          canEmit = val;

          if (canEmit && buffer.length) {
            emitBuffer();
          }
        },
      });

      const sourceSub = source.subscribe({
        next(value) {
          if (canEmit) {
            if (!buffer.length) {
              subscriber.next([value]);
            } else {
              emitBuffer();
            }
          } else {
            buffer.push(value);
          }
        },
        error(error) {
          subscriber.error(error);
        },
        complete() {
          subscriber.complete();
        },
      });

      return () => {
        sourceSub.unsubscribe();
        canEmitSub.unsubscribe();
      };
    });
  };

export type DataStreamHandlerDeps<T> = {
  channelId: LiveChannelId;
  liveEventsObservable: Observable<LiveChannelEvent<T>>;
  onShutdown: () => void;
  subscriberReadiness: Observable<boolean>;
  defaultStreamingFrameOptions: Readonly<StreamingFrameOptions>;
  shutdownDelayInMs: number;
};

enum InternalStreamMessageType {
  Error,
  NewValuesSameSchema,
  ChangedSchema,
}

type InternalStreamMessageTypeToData = {
  [InternalStreamMessageType.Error]: {
    error: DataQueryError;
  };
  [InternalStreamMessageType.ChangedSchema]: {};
  [InternalStreamMessageType.NewValuesSameSchema]: {
    values: unknown[][];
  };
};

type InternalStreamMessage<T = InternalStreamMessageType> = T extends InternalStreamMessageType
  ? {
      type: T;
    } & InternalStreamMessageTypeToData[T]
  : never;

const reduceNewValuesSameSchemaMessages = (
  packets: Array<InternalStreamMessage<InternalStreamMessageType.NewValuesSameSchema>>
) => ({
  values: packets.reduce<unknown[][]>((acc, { values }) => {
    for (let i = 0; i < values.length; i++) {
      if (!acc[i]) {
        acc[i] = [];
      }
      for (let j = 0; j < values[i].length; j++) {
        acc[i].push(values[i][j]);
      }
    }
    return acc;
  }, []),
  type: InternalStreamMessageType.NewValuesSameSchema,
});

const filterMessages = <T extends InternalStreamMessageType>(
  packets: InternalStreamMessage[],
  type: T
): Array<InternalStreamMessage<T>> => packets.filter((p) => p.type === type) as Array<InternalStreamMessage<T>>;

export class LiveDataStream<T = unknown> {
  private frameBuffer: StreamingDataFrame;
  private liveEventsSubscription: Subscription;
  private stream = new Subject<InternalStreamMessage>();
  // The most recent non-error message, replayed to new subscribers so they see
  // the current frame state immediately. Error messages are deliberately not
  // replayed: a transient channel error (e.g. a stale `expired` Centrifuge
  // subscription error) must not surface to subscribers that join the cached
  // stream later as though it were a fresh error.
  private lastNonErrorMessage: InternalStreamMessage | undefined;
  // The most recent error message and whether a subscriber attached at the moment it was emitted
  // already received it. Such an error is replayed to a subscriber that joins later only while it
  // is still the definitive state of the stream: either the channel shut the stream down (no
  // further messages will ever arrive), or it was emitted before any subscriber attached (e.g. an
  // `invalid`/Live-disabled channel) and would otherwise be silently dropped, leaving that
  // subscriber on an empty stream. Errors that a previous subscriber already saw are transient
  // channel conditions and must not be re-served to subscribers joining the cached stream later
  // (see #132368).
  private lastErrorMessage: InternalStreamMessage | undefined;
  private lastErrorWasDelivered = false;
  // Set when the stream is shut down. Because shutdown completes the internal stream, no further
  // messages will ever arrive, making the last error the terminal state of the stream.
  private shutDown = false;
  private shutdownTimeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor(private deps: DataStreamHandlerDeps<T>) {
    this.frameBuffer = StreamingDataFrame.empty(deps.defaultStreamingFrameOptions);
    this.liveEventsSubscription = deps.liveEventsObservable.subscribe({
      error: this.onError,
      complete: this.onComplete,
      next: this.onNext,
    });
  }

  private shutdown = () => {
    this.shutDown = true;
    this.stream.complete();
    this.liveEventsSubscription.unsubscribe();
    this.deps.onShutdown();
  };

  private shutdownIfNoSubscribers = () => {
    if (!this.stream.observed) {
      this.shutdown();
    }
  };

  private onError = (err: unknown) => {
    console.log('LiveQuery [error]', { err }, this.deps.channelId);
    this.emit({
      type: InternalStreamMessageType.Error,
      error: toDataQueryError(err),
    });
    this.shutdown();
  };

  private onComplete = () => {
    console.log('LiveQuery [complete]', this.deps.channelId);
    this.shutdown();
  };

  private onNext = (evt: LiveChannelEvent) => {
    if (isLiveChannelMessageEvent(evt)) {
      this.process(evt.message);
      return;
    }

    const liveChannelStatusEvent = isLiveChannelStatusEvent(evt);
    if (liveChannelStatusEvent && evt.error) {
      const err = toDataQueryError(evt.error);
      this.emit({
        type: InternalStreamMessageType.Error,
        error: {
          ...err,
          message: `Streaming channel error: ${err.message}`,
        },
      });
    }

    if (
      liveChannelStatusEvent &&
      (evt.state === LiveChannelConnectionState.Connected || evt.state === LiveChannelConnectionState.Pending) &&
      evt.message
    ) {
      this.process(evt.message);
    }
  };

  private emit = (message: InternalStreamMessage) => {
    if (message.type === InternalStreamMessageType.Error) {
      this.lastErrorMessage = message;
      // An error emitted while subscribers are attached is delivered to them right away and must
      // not be replayed to subscribers that join the cached stream later (see #132368).
      this.lastErrorWasDelivered = this.stream.observed;
    } else {
      // A non-error message after an error means the channel recovered, so the earlier error is
      // stale and must not surface to subscribers that join later.
      this.lastErrorMessage = undefined;
      this.lastErrorWasDelivered = false;
      this.lastNonErrorMessage = message;
    }
    this.stream.next(message);
  };

  private process = (msg: DataFrameJSON) => {
    const packetInfo = this.frameBuffer.push(msg);

    if (packetInfo.schemaChanged) {
      this.emit({
        type: InternalStreamMessageType.ChangedSchema,
      });
    } else {
      this.emit({
        type: InternalStreamMessageType.NewValuesSameSchema,
        values: this.frameBuffer.getValuesFromLastPacket(),
      });
    }
  };

  // Applies the initial `frame` seed (the query response that opened this stream) to the frame
  // buffer and records it as the frame state to replay to subscribers. Unlike `process()`, this
  // must not be treated as the channel recovering: production always delivers `LiveDataStreamOptions.frame`
  // through `toStreamingDataResponse`, so routing it through `emit()` would wipe a channel error that
  // arrived before the first subscriber (e.g. an `invalid` or Live-disabled channel) and leave that
  // subscriber hanging on an empty stream (see #132368).
  private processInitialFrame = (msg: DataFrameJSON): void => {
    const packetInfo = this.frameBuffer.push(msg);
    const message: InternalStreamMessage = packetInfo.schemaChanged
      ? { type: InternalStreamMessageType.ChangedSchema }
      : {
          type: InternalStreamMessageType.NewValuesSameSchema,
          values: this.frameBuffer.getValuesFromLastPacket(),
        };
    this.lastNonErrorMessage = message;
    this.stream.next(message);
  };

  private resizeBuffer = (bufferOptions: StreamingFrameOptions) => {
    if (bufferOptions && this.frameBuffer.needsResizing(bufferOptions)) {
      this.frameBuffer.resize(bufferOptions);
    }
  };

  private prepareInternalStreamForNewSubscription = (options: LiveDataStreamOptions): void => {
    if (!this.frameBuffer.hasAtLeastOnePacket() && options.frame) {
      // will skip initial frames from subsequent subscribers
      this.processInitialFrame(options.frame);
    }
  };

  private clearShutdownTimeout = () => {
    if (this.shutdownTimeoutId) {
      clearTimeout(this.shutdownTimeoutId);
      this.shutdownTimeoutId = undefined;
    }
  };

  get = (options: LiveDataStreamOptions, subKey: DataStreamSubscriptionKey): Observable<StreamingDataQueryResponse> => {
    this.clearShutdownTimeout();
    const buffer = getStreamingFrameOptions(options.buffer);

    this.resizeBuffer(buffer);
    this.prepareInternalStreamForNewSubscription(options);

    const shouldSendLastPacketOnly = options?.buffer?.action === StreamingFrameAction.Replace;
    const fieldsNamesFilter = options.filter?.fields;
    const dataNeedsFiltering = fieldsNamesFilter?.length;
    const fieldFilterPredicate = dataNeedsFiltering ? ({ name }: Field) => fieldsNamesFilter.includes(name) : undefined;
    let matchingFieldIndexes: number[] | undefined = undefined;

    const getFullFrameResponseData = <T>(
      messages: InternalStreamMessage[],
      error?: DataQueryError
    ): StreamingDataQueryResponse => {
      matchingFieldIndexes = fieldFilterPredicate
        ? this.frameBuffer.getMatchingFieldIndexes(fieldFilterPredicate)
        : undefined;

      if (!shouldSendLastPacketOnly) {
        return {
          key: subKey,
          state: error ? LoadingState.Error : LoadingState.Streaming,
          data: [
            {
              type: StreamingResponseDataType.FullFrame,
              frame: this.frameBuffer.serialize(fieldFilterPredicate, buffer),
            },
          ],
          error,
        };
      }

      if (error) {
        // send empty frame with error
        return {
          key: subKey,
          state: LoadingState.Error,
          data: [
            {
              type: StreamingResponseDataType.FullFrame,
              frame: this.frameBuffer.serialize(fieldFilterPredicate, buffer, { maxLength: 0 }),
            },
          ],
          error,
        };
      }

      if (!messages.length) {
        console.warn(`expected to find at least one non error message ${messages.map(({ type }) => type)}`);
        // send empty frame
        return {
          key: subKey,
          state: LoadingState.Streaming,
          data: [
            {
              type: StreamingResponseDataType.FullFrame,
              frame: this.frameBuffer.serialize(fieldFilterPredicate, buffer, { maxLength: 0 }),
            },
          ],
          error,
        };
      }

      return {
        key: subKey,
        state: LoadingState.Streaming,
        data: [
          {
            type: StreamingResponseDataType.FullFrame,
            frame: this.frameBuffer.serialize(fieldFilterPredicate, buffer, {
              maxLength: this.frameBuffer.packetInfo.length,
            }),
          },
        ],
        error,
      };
    };

    const getNewValuesSameSchemaResponseData = (
      messages: Array<InternalStreamMessage<InternalStreamMessageType.NewValuesSameSchema>>
    ): StreamingDataQueryResponse => {
      const lastMessage = messages.length ? messages[messages.length - 1] : undefined;
      const values =
        shouldSendLastPacketOnly && lastMessage
          ? lastMessage.values
          : reduceNewValuesSameSchemaMessages(messages).values;

      const filteredValues = matchingFieldIndexes ? values.filter((v, i) => matchingFieldIndexes?.includes(i)) : values;

      return {
        key: subKey,
        state: LoadingState.Streaming,
        data: [
          {
            type: StreamingResponseDataType.NewValuesSameSchema,
            values: filteredValues,
          },
        ],
      };
    };

    // Replay the most recent non-error message to this subscriber only, so a
    // late subscriber immediately sees the current frame state without
    // inheriting a transient channel error that was emitted earlier.
    const internalStreamForSubscriber = new Observable<InternalStreamMessage>((subscriber) => {
      if (this.lastNonErrorMessage !== undefined) {
        subscriber.next(this.lastNonErrorMessage);
      }

      // Replay the most recent error message only when it was never delivered to any subscriber
      // (it arrived before the first `get()` subscriber attached) or the stream has already shut
      // down - so a subscriber joining after an `invalid`/Live-disabled channel failure still
      // learns about it instead of hanging on an empty stream.
      if (this.lastErrorMessage !== undefined && (this.shutDown || !this.lastErrorWasDelivered)) {
        subscriber.next(this.lastErrorMessage);
      }
      return this.stream.subscribe(subscriber);
    });

    let shouldSendFullFrame = true;
    const transformedInternalStream = internalStreamForSubscriber.pipe(
      bufferIfNot(this.deps.subscriberReadiness),
      map((messages, i) => {
        const errors = filterMessages(messages, InternalStreamMessageType.Error);
        const lastError = errors.length ? errors[errors.length - 1].error : undefined;

        if (shouldSendFullFrame) {
          shouldSendFullFrame = false;
          return getFullFrameResponseData(messages, lastError);
        }

        if (errors.length) {
          // send the latest frame with the last error, discard everything else
          return getFullFrameResponseData(messages, lastError);
        }

        const schemaChanged = messages.some((n) => n.type === InternalStreamMessageType.ChangedSchema);
        if (schemaChanged) {
          // send the latest frame, discard intermediate appends
          return getFullFrameResponseData(messages, undefined);
        }

        const newValueSameSchemaMessages = filterMessages(messages, InternalStreamMessageType.NewValuesSameSchema);
        if (newValueSameSchemaMessages.length !== messages.length) {
          console.warn(`unsupported message type ${messages.map(({ type }) => type)}`);
        }

        return getNewValuesSameSchemaResponseData(newValueSameSchemaMessages);
      })
    );

    return new Observable<StreamingDataQueryResponse>((subscriber) => {
      const sub = transformedInternalStream.subscribe({
        next: (n) => {
          subscriber.next(n);
        },
        error: (err) => {
          subscriber.error(err);
        },
        complete: () => {
          subscriber.complete();
        },
      });

      return () => {
        // TODO: potentially resize (downsize) the buffer on unsubscribe
        sub.unsubscribe();
        if (!this.stream.observed) {
          this.clearShutdownTimeout();
          this.shutdownTimeoutId = setTimeout(this.shutdownIfNoSubscribers, this.deps.shutdownDelayInMs);
        }
      };
    });
  };
}
