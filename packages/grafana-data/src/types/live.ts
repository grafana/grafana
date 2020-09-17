/**
 * @experimental
 */
export interface ChannelHandler<T = any> {
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
}

/**
 * @experimental
 */
export interface ChannelSupport {
  /**
   * Get the channel handler for this plugin or null if the channel shoudl not be opened
   */
  getChannelHandler(path: string): ChannelHandler | null;

  /**
   * If a channel should support publishing, return the body that should be sent
   * Throw an error if the path should not support publishing a message
   */
  onPublish?: (path: string, body: any) => any;
}
