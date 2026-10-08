/** Newest entries kept per kind, so a burst of one kind of page never evicts the others. */
export const PAGE_HISTORY_MAX_PER_KIND = 5;

/**
 * What a visited URL resolves to, with the pathname it was derived from (base-url-less, no trailing slash);
 * one history row per identity. Derived again on every load, never stored, so a rule change reclassifies old rows.
 */
export type PageIdentity = { pathname: string } & (
  | { kind: 'dashboard'; uid: string }
  | { kind: 'explore' }
  | { kind: 'alerting' }
  | { kind: 'app' }
);

export type PageHistoryKind = PageIdentity['kind'];

export type PageHistoryEntry = PageIdentity & {
  /** Newest `location.search` seen for this page (`''` or `?...`), so a row links back to the exact state. */
  search: string;
  /** Epoch ms of the last visit or in-page URL update. */
  lastVisited: number;
  /**
   * The title the page gave the chrome (its `pageNav` text, else its section's); absent until the page sets its nav.
   * Only alerting and app deep links show it, so a rule or incident page reads as its name instead of its path.
   */
  title?: string;
};
