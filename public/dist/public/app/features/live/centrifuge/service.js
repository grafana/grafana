import { __awaiter } from "tslib";
import { Centrifuge, State, } from 'centrifuge';
import { BehaviorSubject, share, startWith } from 'rxjs';
import { LiveChannelConnectionState, toLiveChannelId, } from '@grafana/data';
import { StreamingFrameAction, } from '@grafana/runtime/src/services/live';
import { LiveDataStream } from './LiveDataStream';
import { CentrifugeLiveChannel } from './channel';
const defaultStreamingFrameOptions = {
    maxLength: 100,
    maxDelta: Infinity,
    action: StreamingFrameAction.Append,
};
const dataStreamShutdownDelayInMs = 5000;
export class CentrifugeService {
    constructor(deps) {
        this.deps = deps;
        this.open = new Map();
        this.liveDataStreamByChannelId = {};
        //----------------------------------------------------------
        // Internal functions
        //----------------------------------------------------------
        this.onConnect = (context) => {
            this.connectionState.next(true);
        };
        this.onDisconnect = (context) => {
            this.connectionState.next(false);
        };
        this.onServerSideMessage = (context) => {
            console.log('Publication from server-side channel', context);
        };
        //----------------------------------------------------------
        // Exported functions
        //----------------------------------------------------------
        /**
         * Listen for changes to the connection state
         */
        this.getConnectionState = () => {
            return this.connectionState.asObservable();
        };
        /**
         * Watch for messages in a channel
         */
        this.getStream = (address) => {
            return this.getChannel(address).getStream();
        };
        this.createSubscriptionKey = (options) => { var _a; return (_a = options.key) !== null && _a !== void 0 ? _a : `xstr/${streamCounter++}`; };
        this.getLiveDataStream = (options) => {
            const channelId = toLiveChannelId(options.addr);
            const existingStream = this.liveDataStreamByChannelId[channelId];
            if (existingStream) {
                return existingStream;
            }
            const channel = this.getChannel(options.addr);
            this.liveDataStreamByChannelId[channelId] = new LiveDataStream({
                channelId,
                onShutdown: () => {
                    delete this.liveDataStreamByChannelId[channelId];
                },
                liveEventsObservable: channel.getStream(),
                subscriberReadiness: this.dataStreamSubscriberReadiness,
                defaultStreamingFrameOptions,
                shutdownDelayInMs: dataStreamShutdownDelayInMs,
            });
            return this.liveDataStreamByChannelId[channelId];
        };
        /**
         * Connect to a channel and return results as DataFrames
         */
        this.getDataStream = (options) => {
            const subscriptionKey = this.createSubscriptionKey(options);
            const stream = this.getLiveDataStream(options);
            return stream.get(options, subscriptionKey);
        };
        /**
         * Executes a query over the live websocket. Query response can contain live channels we can subscribe to for further updates
         *
         * Since the initial request and subscription are on the same socket, this will support HA setups
         */
        this.getQueryData = (options) => __awaiter(this, void 0, void 0, function* () {
            if (this.centrifuge.state !== State.Connected) {
                yield this.connectionBlocker;
            }
            return this.centrifuge.rpc('grafana.query', options.body);
        });
        /**
         * For channels that support presence, this will request the current state from the server.
         *
         * Join and leave messages will be sent to the open stream
         */
        this.getPresence = (address) => {
            return this.getChannel(address).getPresence();
        };
        this.dataStreamSubscriberReadiness = deps.dataStreamSubscriberReadiness.pipe(share(), startWith(true));
        let liveUrl = `${deps.appUrl.replace(/^http/, 'ws')}/api/live/ws`;
        const token = deps.grafanaAuthToken;
        if (token !== null && token !== '') {
            liveUrl += '?auth_token=' + token;
        }
        this.centrifuge = new Centrifuge(liveUrl, {
            timeout: 30000,
        });
        // orgRole is set when logged in *or* anonymous users can use grafana
        if (deps.liveEnabled && deps.orgRole !== '') {
            this.centrifuge.connect(); // do connection
        }
        this.connectionState = new BehaviorSubject(this.centrifuge.state === State.Connected);
        this.connectionBlocker = new Promise((resolve) => {
            if (this.centrifuge.state === State.Connected) {
                return resolve();
            }
            const connectListener = () => {
                resolve();
                this.centrifuge.removeListener('connected', connectListener);
            };
            this.centrifuge.addListener('connected', connectListener);
        });
        // Register global listeners
        this.centrifuge.on('connected', this.onConnect);
        this.centrifuge.on('connecting', this.onDisconnect);
        this.centrifuge.on('disconnected', this.onDisconnect);
        this.centrifuge.on('publication', this.onServerSideMessage);
    }
    /**
     * Get a channel.  If the scope, namespace, or path is invalid, a shutdown
     * channel will be returned with an error state indicated in its status
     */
    getChannel(addr) {
        const id = `${this.deps.orgId}/${addr.scope}/${addr.namespace}/${addr.path}`;
        let channel = this.open.get(id);
        if (channel != null) {
            return channel;
        }
        channel = new CentrifugeLiveChannel(id, addr);
        if (channel.currentStatus.state === LiveChannelConnectionState.Invalid) {
            return channel;
        }
        channel.shutdownCallback = () => {
            this.open.delete(id);
            // without a call to `removeSubscription`, the subscription will remain in centrifuge's internal registry
            this.centrifuge.removeSubscription(this.centrifuge.getSubscription(id));
        };
        this.open.set(id, channel);
        // Initialize the channel in the background
        this.initChannel(channel).catch((err) => {
            if (channel) {
                channel.currentStatus.state = LiveChannelConnectionState.Invalid;
                channel.shutdownWithError(err);
            }
            this.open.delete(id);
        });
        // return the not-yet initialized channel
        return channel;
    }
    initChannel(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.centrifuge.state !== State.Connected) {
                yield this.connectionBlocker;
            }
            const subscription = this.centrifuge.newSubscription(channel.id, {
                data: channel.addr.data,
            });
            channel.subscription = subscription;
            channel.initalize();
            subscription.subscribe();
            return;
        });
    }
}
// This is used to give a unique key for each stream.  The actual value does not matter
let streamCounter = 0;
//# sourceMappingURL=service.js.map