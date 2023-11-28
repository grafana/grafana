import { map, Observable, ReplaySubject } from 'rxjs';
import { isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelConnectionState, LoadingState, StreamingDataFrame, } from '@grafana/data';
import { getStreamingFrameOptions } from '@grafana/data/src/dataframe/StreamingDataFrame';
import { StreamingFrameAction } from '@grafana/runtime/src/services/live';
import { toDataQueryError } from '@grafana/runtime/src/utils/toDataQueryError';
import { StreamingResponseDataType } from '../data/utils';
const bufferIfNot = (canEmitObservable) => (source) => {
    return new Observable((subscriber) => {
        let buffer = [];
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
                    }
                    else {
                        emitBuffer();
                    }
                }
                else {
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
var InternalStreamMessageType;
(function (InternalStreamMessageType) {
    InternalStreamMessageType[InternalStreamMessageType["Error"] = 0] = "Error";
    InternalStreamMessageType[InternalStreamMessageType["NewValuesSameSchema"] = 1] = "NewValuesSameSchema";
    InternalStreamMessageType[InternalStreamMessageType["ChangedSchema"] = 2] = "ChangedSchema";
})(InternalStreamMessageType || (InternalStreamMessageType = {}));
const reduceNewValuesSameSchemaMessages = (packets) => ({
    values: packets.reduce((acc, { values }) => {
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
const filterMessages = (packets, type) => packets.filter((p) => p.type === type);
export class LiveDataStream {
    constructor(deps) {
        this.deps = deps;
        this.stream = new ReplaySubject(1);
        this.shutdown = () => {
            this.stream.complete();
            this.liveEventsSubscription.unsubscribe();
            this.deps.onShutdown();
        };
        this.shutdownIfNoSubscribers = () => {
            if (!this.stream.observed) {
                this.shutdown();
            }
        };
        this.onError = (err) => {
            console.log('LiveQuery [error]', { err }, this.deps.channelId);
            this.stream.next({
                type: InternalStreamMessageType.Error,
                error: toDataQueryError(err),
            });
            this.shutdown();
        };
        this.onComplete = () => {
            console.log('LiveQuery [complete]', this.deps.channelId);
            this.shutdown();
        };
        this.onNext = (evt) => {
            if (isLiveChannelMessageEvent(evt)) {
                this.process(evt.message);
                return;
            }
            const liveChannelStatusEvent = isLiveChannelStatusEvent(evt);
            if (liveChannelStatusEvent && evt.error) {
                const err = toDataQueryError(evt.error);
                this.stream.next({
                    type: InternalStreamMessageType.Error,
                    error: Object.assign(Object.assign({}, err), { message: `Streaming channel error: ${err.message}` }),
                });
            }
            if (liveChannelStatusEvent &&
                (evt.state === LiveChannelConnectionState.Connected || evt.state === LiveChannelConnectionState.Pending) &&
                evt.message) {
                this.process(evt.message);
            }
        };
        this.process = (msg) => {
            const packetInfo = this.frameBuffer.push(msg);
            if (packetInfo.schemaChanged) {
                this.stream.next({
                    type: InternalStreamMessageType.ChangedSchema,
                });
            }
            else {
                this.stream.next({
                    type: InternalStreamMessageType.NewValuesSameSchema,
                    values: this.frameBuffer.getValuesFromLastPacket(),
                });
            }
        };
        this.resizeBuffer = (bufferOptions) => {
            if (bufferOptions && this.frameBuffer.needsResizing(bufferOptions)) {
                this.frameBuffer.resize(bufferOptions);
            }
        };
        this.prepareInternalStreamForNewSubscription = (options) => {
            if (!this.frameBuffer.hasAtLeastOnePacket() && options.frame) {
                // will skip initial frames from subsequent subscribers
                this.process(options.frame);
            }
        };
        this.clearShutdownTimeout = () => {
            if (this.shutdownTimeoutId) {
                clearTimeout(this.shutdownTimeoutId);
                this.shutdownTimeoutId = undefined;
            }
        };
        this.get = (options, subKey) => {
            var _a, _b;
            this.clearShutdownTimeout();
            const buffer = getStreamingFrameOptions(options.buffer);
            this.resizeBuffer(buffer);
            this.prepareInternalStreamForNewSubscription(options);
            const shouldSendLastPacketOnly = ((_a = options === null || options === void 0 ? void 0 : options.buffer) === null || _a === void 0 ? void 0 : _a.action) === StreamingFrameAction.Replace;
            const fieldsNamesFilter = (_b = options.filter) === null || _b === void 0 ? void 0 : _b.fields;
            const dataNeedsFiltering = fieldsNamesFilter === null || fieldsNamesFilter === void 0 ? void 0 : fieldsNamesFilter.length;
            const fieldFilterPredicate = dataNeedsFiltering ? ({ name }) => fieldsNamesFilter.includes(name) : undefined;
            let matchingFieldIndexes = undefined;
            const getFullFrameResponseData = (messages, error) => {
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
            const getNewValuesSameSchemaResponseData = (messages) => {
                const lastMessage = messages.length ? messages[messages.length - 1] : undefined;
                const values = shouldSendLastPacketOnly && lastMessage
                    ? lastMessage.values
                    : reduceNewValuesSameSchemaMessages(messages).values;
                const filteredValues = matchingFieldIndexes ? values.filter((v, i) => matchingFieldIndexes === null || matchingFieldIndexes === void 0 ? void 0 : matchingFieldIndexes.includes(i)) : values;
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
            let shouldSendFullFrame = true;
            const transformedInternalStream = this.stream.pipe(bufferIfNot(this.deps.subscriberReadiness), map((messages, i) => {
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
            }));
            return new Observable((subscriber) => {
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
        this.frameBuffer = StreamingDataFrame.empty(deps.defaultStreamingFrameOptions);
        this.liveEventsSubscription = deps.liveEventsObservable.subscribe({
            error: this.onError,
            complete: this.onComplete,
            next: this.onNext,
        });
    }
}
//# sourceMappingURL=LiveDataStream.js.map