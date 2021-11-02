/**
 * The channel id is defined as:
 *
 *   ${scope}/${namespace}/${path}
 *
 * The scope drives how the namespace is used and controlled
 *
 * @alpha
 */
export var LiveChannelScope;
(function (LiveChannelScope) {
    LiveChannelScope["DataSource"] = "ds";
    LiveChannelScope["Plugin"] = "plugin";
    LiveChannelScope["Grafana"] = "grafana";
    LiveChannelScope["Stream"] = "stream";
})(LiveChannelScope || (LiveChannelScope = {}));
/**
 * The type of data to expect in a given channel
 *
 * @alpha
 */
export var LiveChannelType;
(function (LiveChannelType) {
    LiveChannelType["DataStream"] = "stream";
    LiveChannelType["DataFrame"] = "frame";
    LiveChannelType["JSON"] = "json";
})(LiveChannelType || (LiveChannelType = {}));
export var LiveChannelConnectionState;
(function (LiveChannelConnectionState) {
    /** The connection is not yet established */
    LiveChannelConnectionState["Pending"] = "pending";
    /** Connected to the channel */
    LiveChannelConnectionState["Connected"] = "connected";
    /** Disconnected from the channel.  The channel will reconnect when possible */
    LiveChannelConnectionState["Disconnected"] = "disconnected";
    /** Was at some point connected, and will not try to reconnect */
    LiveChannelConnectionState["Shutdown"] = "shutdown";
    /** Channel configuraiton was invalid and will not connect */
    LiveChannelConnectionState["Invalid"] = "invalid";
})(LiveChannelConnectionState || (LiveChannelConnectionState = {}));
export var LiveChannelEventType;
(function (LiveChannelEventType) {
    LiveChannelEventType["Status"] = "status";
    LiveChannelEventType["Join"] = "join";
    LiveChannelEventType["Leave"] = "leave";
    LiveChannelEventType["Message"] = "message";
})(LiveChannelEventType || (LiveChannelEventType = {}));
export function isLiveChannelStatusEvent(evt) {
    return evt.type === LiveChannelEventType.Status;
}
export function isLiveChannelJoinEvent(evt) {
    return evt.type === LiveChannelEventType.Join;
}
export function isLiveChannelLeaveEvent(evt) {
    return evt.type === LiveChannelEventType.Leave;
}
export function isLiveChannelMessageEvent(evt) {
    return evt.type === LiveChannelEventType.Message;
}
/**
 * Return an address from a string
 *
 * @alpha -- experimental
 */
export function parseLiveChannelAddress(id) {
    if (id === null || id === void 0 ? void 0 : id.length) {
        var parts = id.trim().split('/');
        if (parts.length >= 3) {
            return {
                scope: parts[0],
                namespace: parts[1],
                path: parts.slice(2).join('/'),
            };
        }
    }
    return undefined;
}
/**
 * Check if the address has a scope, namespace, and path
 *
 * @alpha -- experimental
 */
export function isValidLiveChannelAddress(addr) {
    return !!((addr === null || addr === void 0 ? void 0 : addr.path) && addr.namespace && addr.scope);
}
/**
 * Convert the address to an explicit channel path
 *
 * @alpha -- experimental
 */
export function toLiveChannelId(addr) {
    if (!addr.scope) {
        return '';
    }
    var id = addr.scope;
    if (!addr.namespace) {
        return id;
    }
    id += '/' + addr.namespace;
    if (!addr.path) {
        return id;
    }
    return id + '/' + addr.path;
}
//# sourceMappingURL=live.js.map