/**
 * Cross-tab session synchronization using BroadcastChannel.
 *
 * When a user logs in on one tab, other tabs on the same origin receive
 * a message and reload so they pick up the new session cookie.
 *
 * Falls back to a no-op if BroadcastChannel is not supported (e.g. some
 * older browsers or certain iframe contexts).
 */

const CHANNEL_NAME = 'grafana_session';

type SessionMessage = { type: 'login' };

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

/**
 * Notify other tabs that a login just succeeded in this tab.
 */
export function broadcastLogin(): void {
  const channel = getChannel();
  if (!channel) {
    return;
  }
  const msg: SessionMessage = { type: 'login' };
  channel.postMessage(msg);
  channel.close();
}

/**
 * Listen for login events from other tabs and call the provided callback.
 * Returns a cleanup function that removes the listener.
 */
export function onLoginFromOtherTab(callback: () => void): () => void {
  const channel = getChannel();
  if (!channel) {
    return () => {};
  }

  const handler = (event: MessageEvent<SessionMessage>) => {
    if (event.data?.type === 'login') {
      callback();
    }
  };

  channel.addEventListener('message', handler);

  return () => {
    channel.removeEventListener('message', handler);
    channel.close();
  };
}
