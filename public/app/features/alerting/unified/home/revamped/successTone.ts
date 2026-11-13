export type Tone = 'error' | 'warning' | 'success' | 'info' | 'neutral';

// At or above this share of successes a tile is green.
const HEALTHY_SHARE = 0.995;
// Below this share it is red; between the two, yellow.
const DEGRADED_SHARE = 0.99;

/** The tone for a success share between 0 and 1, such as evaluations or notifications that succeeded. */
export function getSuccessTone(share: number | undefined): Tone {
  if (share === undefined) {
    return 'neutral';
  }
  if (share >= HEALTHY_SHARE) {
    return 'success';
  }
  return share >= DEGRADED_SHARE ? 'warning' : 'error';
}

// A channel is green at or above this share of successful attempts.
const CHANNEL_HEALTHY_SHARE = 0.995;
// Below this share it is red; between the two, yellow.
const CHANNEL_DEGRADED_SHARE = 0.98;

/** The tone for one notification channel's share of successful attempts, between 0 and 1. */
export function getChannelTone(share: number | undefined): Tone {
  if (share === undefined) {
    return 'neutral';
  }
  if (share >= CHANNEL_HEALTHY_SHARE) {
    return 'success';
  }
  return share >= CHANNEL_DEGRADED_SHARE ? 'warning' : 'error';
}
