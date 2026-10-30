/**
 * What a visited URL resolves to, with the pathname it was derived from (base-url-less, no trailing slash);
 * one history row per identity. Derived again on every load from the stored pathname and search, never
 * stored, so a rule change reclassifies old rows.
 */
export type PageIdentity = { pathname: string } & (
  | { kind: 'dashboard'; uid: string }
  /** `session` is the left pane's id; Explore keeps it through query edits and splits, so it tells sessions apart. */
  | { kind: 'explore'; session: string }
  /** A Grafana Page (the Assistant app's `/pages/<id>`); its own kind so it is not just another app page. */
  | { kind: 'page' }
  | { kind: 'alerting' }
  | { kind: 'app' }
);

export type PageHistoryKind = PageIdentity['kind'];

export type PageHistoryEntry = PageIdentity & {
  /** Newest `location.search` seen for this page (`''` or `?...`), so a row links back to the exact state. */
  search: string;
  /**
   * Epoch ms of the row's last revision: a visit, an in-page URL update or the page setting its title. Absent on
   * rows seeded from the recently-viewed impressions, which carry no time.
   */
  lastVisited?: number;
  /** The title the page gave the chrome (its `pageNav` text, else its section's); absent until the page sets its nav. */
  title?: string;
};
