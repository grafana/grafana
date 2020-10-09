import { SelectableValue } from './select';
import { Observable } from 'rxjs';

/**
 * The channel id is defined as:
 *
 *   ${scope}/${namespace}/${path}
 *
 * The scope drives how the namespace is used and controlled
 */
export enum LiveChannelScope {
  DataSource = 'ds', // namespace = data source ID
  Plugin = 'plugin', // namespace = plugin name (singleton works for apps too)
  Grafana = 'grafana', // namespace = feature
}

/**
 * @experimental
 */
export interface LiveChannelConfig<TMessage = any> {
  /**
   * The path definition.  either static, or it may contain variables identifed with {varname}
   */
  path: string;

  /**
   * An optional description for the channel
   */
  description?: string;

  /**
   * When variables exist, this list will identify each one
   */
  variables?: Array<SelectableValue<string>>;

  /**
   * The channel keeps track of who else is connected to the same channel
   */
  hasPresence?: boolean;

  /**
   * This method will be defined if it is possible to publish in this channel.
   * The function will return true/false if the current user can publish
   */
  canPublish?: () => boolean;

  /** convert the raw stream message into a message that should be broadcast */
  processMessage?: (msg: any) => TMessage;
}

export enum LiveChannelConnectionState {
  /** The connection is not yet established */
  Pending = 'pending',
  /** Connected to the channel */
  Connected = 'connected',
  /** Disconnected from the channel.  The channel will reconnect when possible */
  Disconnected = 'disconnected',
  /** Was at some point connected, and will not try to reconnect */
  Shutdown = 'shutdown',
  /** Channel configuraiton was invalid and will not connect */
  Invalid = 'invalid',
}

export enum LiveChannelEventType {
  Status = 'status',
  Join = 'join',
  Leave = 'leave',
  Message = 'message',
}

/**
 * @experimental
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
   * The last error.
   *
   * This will remain in the status until a new message is successfully received from the channel
   */
  error?: any;
}

export interface LiveChannelJoinEvent {
  type: LiveChannelEventType.Join;
  user: any; // @experimental -- will be filled in when we improve the UI
}

export interface LiveChannelLeaveEvent {
  type: LiveChannelEventType.Leave;
  user: any; // @experimental -- will be filled in when we improve the UI
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
 * @experimental
 */
export interface LiveChannelPresenceStatus {
  users: any; // @experimental -- will be filled in when we improve the UI
}

/**
 * @experimental
 */
export interface LiveChannelAddress {
  scope: LiveChannelScope;
  namespace: string; // depends on the scope
  path: string;
}

/**
 * Check if the address has a scope, namespace, and path
 */
export function isValidLiveChannelAddress(addr?: LiveChannelAddress): addr is LiveChannelAddress {
  return !!(addr?.path && addr.namespace && addr.scope);
}

/**
 * @experimental
 */
export interface LiveChannel<TMessage = any, TPublish = any> {
  /** The fully qualified channel id: ${scope}/${namespace}/${path} */
  id: string;

  /** The channel address */
  addr: LiveChannelAddress;

  /** Unix timestamp for when the channel connected */
  opened: number;

  /** Static definition of the channel definition.  This may describe the channel usage */
  config?: LiveChannelConfig;

  /**
   * Watch all events in this channel
   */
  getStream: () => Observable<LiveChannelEvent<TMessage>>;

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  getPresence?: () => Promise<LiveChannelPresenceStatus>;

  /**
   * Write a message into the channel
   *
   * NOTE: This feature is supported by a limited set of channels
   */
  publish?: (msg: TPublish) => Promise<any>;

  /**
   * This will close and terminate this channel
   */
  disconnect: () => void;
}

/**
 * @experimental
 */
export interface LiveChannelSupport {
  /**
   * Get the channel handler for the path, or throw an error if invalid
   */
  getChannelConfig(path: string): LiveChannelConfig | undefined;

  /**
   * Return a list of supported channels
   */
  getSupportedPaths(): LiveChannelConfig[];
}
