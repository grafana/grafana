import { SelectableValue } from './select';

/**
 * @experimental
 */
export interface ChannelMeta {
  path: string; // the channel name
  description?: string;
  variables?: Array<SelectableValue<string>>; // Describe the variables within the path syntax
}

/**
 * @experimental
 */
export interface ChannelHandler<T = any> {
  meta?: ChannelMeta;

  /**
   * Callback when subscribed
   */
  onSubscribe?: (ctx: any) => void;

  /**
   * Callback when unsubscribed
   */
  onUnsubscribe?: (ctx: any) => void;

  /**
   * Called when a message is sent to this channel.  This function is used
   * to transform the raw message from the server into a message that will
   * be broadcast to all subscribers of the channel
   */
  onMessageReceived?: (msg: any) => T;

  /**
   * Called when an error occurs in the channel
   */
  onError?: (ctx: any) => void;

  /**
   * Called when someone joins the channel
   */
  onJoin?: (ctx: any) => void;

  /**
   * Called when someone leaves the channel
   */
  onLeave?: (ctx: any) => void;

  /**
   * This function must be defined for the channel to support publishing events
   * into the websocket.  NOTE, the backend plugin must also allow publishing
   * for this to work succesfully
   */
  onPublish?: (body: any) => any;
}

/**
 * @experimental
 */
export interface ChannelSupport {
  /**
   * Get the channel handler for the path, or throw an error if invalid
   */
  getChannelHandler(path: string): ChannelHandler;

  /**
   * Return a list of supported channels
   */
  getChannels(): ChannelMeta[];
}
