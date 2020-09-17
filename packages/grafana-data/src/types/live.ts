/**
 * @experimental
 */
export interface ChannelHandler<T = any> {
  /**
   * Process the raw message from the server before broadcasting it
   * to the channel stream
   */
  onMessageReceived(msg: any): T;
}

// NOTE: this is actually backed by centrefuge type:
//
// export interface SubscriptionEvents {
//   publish?: (ctx: PublicationContext) => void;
//   join?: (ctx: JoinLeaveContext) => void;
//   leave?: (ctx: JoinLeaveContext) => void;
//   subscribe?: (ctx: SubscribeSuccessContext) => void;
//   error?: (ctx: SubscribeErrorContext) => void;
//   unsubscribe?: (ctx: UnsubscribeContext) => void;
// }

export const StandardChannelHandler: ChannelHandler = {
  onMessageReceived: v => v, // Just pass the object along
};

/**
 * @experimental
 */
export interface LiveChannelSupport {
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
