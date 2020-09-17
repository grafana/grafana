/**
 * @experimental
 */
export interface ChannelHandler<T = any> {
  /**
   * Indicate if the channel should try to publish to the service.  Even when
   * this is enabled, the backend support for the channel may not support publish
   */
  allowPublish?: boolean;

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
  onMessageReceived: (v: any) => {
    return v; // Just pass the object along
  },
};

/**
 * @experimental
 */
export interface ChannelSupport {
  /**
   * Get the channel handler for this plugin or null if the channel shoudl not be opened
   */
  getChannelHandler(path: string): ChannelHandler | null;
}
