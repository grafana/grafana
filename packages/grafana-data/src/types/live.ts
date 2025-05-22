/**
 * The channel id is defined as:
 *
 *   ${scope}/${namespace}/${path}
 *
 * The scope drives how the namespace is used and controlled
 *
 * @alpha
 */
export enum LiveChannelScope {
  DataSource = 'ds', // namespace = data source ID
  Plugin = 'plugin', // namespace = plugin name (singleton works for apps too)
  Grafana = 'grafana', // namespace = feature
  Stream = 'stream', // namespace = id for the managed data stream
  Watch = 'watch', // namespace = k8s group we will watch
}

/**
 * The type of data to expect in a given channel
 *
 * @alpha
 */
export enum LiveChannelType {
  DataStream = 'stream', // each message contains a batch of rows that will be appended to previous values
  DataFrame = 'frame', // each message is an entire data frame and should *replace* previous content
  JSON = 'json', // arbitrary json message
}

export enum LiveChannelConnectionState {
  /** The connection is not yet established */
  Pending = 'pending',
  /** Connected to the channel */
  Connected = 'connected',
  /** Connecting to a channel */
  Connecting = 'connecting',
  /** Disconnected from the channel.  The channel will reconnect when possible */
  Disconnected = 'disconnected',
  /** Was at some point connected, and will not try to reconnect */
  Shutdown = 'shutdown',
  /** Channel configuration was invalid and will not connect */
  Invalid = 'invalid',
}

export enum LiveChannelEventType {
  Status = 'status',
  Join = 'join',
  Leave = 'leave',
  Message = 'message',
}

/**
 * @alpha -- experimental
 */
export interface LiveChannelStatusEvent {
  type: LiveChannelEventType.Status;

  /**
   * {scope}/{namespace}/{path}
   */
  id: string;

  /**
   * unix millies timestamp for the last status change
   */
  timestamp: number;

  /**
   * flag if the channel is actively connected to the channel.
   * This may be false while the connections get established or if the network is lost
   * As long as the `shutdown` flag is not set, the connection will try to reestablish
   */
  state: LiveChannelConnectionState;

  /**
   * When joining a channel, there may be an initial packet in the subscribe method
   */
  message?: any;

  /**
   * The last error.
   *
   * This will remain in the status until a new message is successfully received from the channel
   */
  error?: any;
}

export interface LiveChannelJoinEvent {
  type: LiveChannelEventType.Join;
  user: any; // @alpha -- experimental -- will be filled in when we improve the UI
}

export interface LiveChannelLeaveEvent {
  type: LiveChannelEventType.Leave;
  user: any; // @alpha -- experimental -- will be filled in when we improve the UI
}

export interface LiveChannelMessageEvent<T> {
  type: LiveChannelEventType.Message;
  message: T;
}

export type LiveChannelEvent<T = any> =
  | LiveChannelStatusEvent
  | LiveChannelJoinEvent
  | LiveChannelLeaveEvent
  | LiveChannelMessageEvent<T>;

export function isLiveChannelStatusEvent<T>(evt: LiveChannelEvent<T>): evt is LiveChannelStatusEvent {
  return evt.type === LiveChannelEventType.Status;
}

export function isLiveChannelJoinEvent<T>(evt: LiveChannelEvent<T>): evt is LiveChannelJoinEvent {
  return evt.type === LiveChannelEventType.Join;
}

export function isLiveChannelLeaveEvent<T>(evt: LiveChannelEvent<T>): evt is LiveChannelLeaveEvent {
  return evt.type === LiveChannelEventType.Leave;
}

export function isLiveChannelMessageEvent<T>(evt: LiveChannelEvent<T>): evt is LiveChannelMessageEvent<T> {
  return evt.type === LiveChannelEventType.Message;
}

/**
 * @alpha -- experimental
 */
export interface LiveChannelPresenceStatus {
  users: any; // @alpha -- experimental -- will be filled in when we improve the UI
}

/**
 * @alpha -- experimental
 */
export type LiveChannelId = string;

/**
 * @alpha -- experimental
 */
export interface LiveChannelAddress {
  scope: LiveChannelScope;
  namespace: string; // depends on the scope
  path: string;

  /**
   * Additional metadata passed to a channel.  The backend will propagate this JSON object to
   * each OnSubscribe and RunStream calls.  This value should be constant across multiple requests
   * to the same channel path
   */
  data?: any;
}

/**
 * Return an address from a string
 *
 * @alpha -- experimental
 */
export function parseLiveChannelAddress(id?: string): LiveChannelAddress | undefined {
  if (id?.length) {
    let parts = id.trim().split('/');
    if (parts.length >= 3) {
      return {
        scope: parts[0] as LiveChannelScope,
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
export function isValidLiveChannelAddress(addr?: LiveChannelAddress): addr is LiveChannelAddress {
  return !!(addr?.path && addr.namespace && addr.scope);
}

/**
 * Convert the address to an explicit channel path
 *
 * @alpha -- experimental
 */
export function toLiveChannelId(addr: LiveChannelAddress): LiveChannelId {
  if (!addr.scope) {
    return '';
  }
  let id: string = addr.scope;
  if (!addr.namespace) {
    return id;
  }
  id += '/' + addr.namespace;
  if (!addr.path) {
    return id;
  }
  return id + '/' + addr.path;
}
