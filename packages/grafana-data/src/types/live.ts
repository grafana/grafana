/**
 * @experimental
 */
export interface ChannelHandler<T = any> {
  /**
   * Callback once subscribed
   */
  onSubscribe?: (ctx: any) => void;

  /**
   * Callback once subscribed
   */
  onUnsubscribe?: (ctx: any) => void;

  /**
   * Process the raw message from the server before broadcasting it
   * to the channel stream
   */
  onMessageReceived?: (msg: any) => T;

  /**
   * Error in the channel
   */
  onError?: (ctx: any) => void;

  /**
   * Callback once subscribed
   */
  onJoin?: (ctx: any) => void;

  /**
   * Callback once subscribed
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
