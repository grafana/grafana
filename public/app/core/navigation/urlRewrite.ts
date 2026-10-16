import * as H from 'history';

/**
 * Flags a history REPLACE as an in-place rewrite of the current page's URL - the user is not
 * leaving the page, the URL is just being corrected (dashboard slug normalization, home-route
 * resolution). Journey trackers (Faro page meta) keep their navigation chain intact for flagged
 * entries; an unflagged REPLACE counts as a navigation.
 *
 * Wrap the argument of any `locationService.replace()` that does not represent the user leaving
 * the page. Missing the flag on a rewrite degrades to a noisy self-transition in journey metrics;
 * flagging a real navigation hides the transition - when in doubt, leave it unflagged.
 */
export function markAsUrlRewrite(location: H.Path | H.LocationDescriptorObject): H.LocationDescriptorObject {
  const descriptor = typeof location === 'string' ? H.parsePath(location) : location;
  const state = typeof descriptor.state === 'object' && descriptor.state !== null ? descriptor.state : {};
  return { ...descriptor, state: { ...state, urlRewrite: true } };
}

export function isUrlRewrite(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'urlRewrite' in state && state.urlRewrite === true;
}
