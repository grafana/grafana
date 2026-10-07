/** Newest entries kept per kind, so a burst of one kind of page never evicts the others. */
export const PAGE_HISTORY_MAX_PER_KIND = 5;

/** What a visited URL resolves to; one history row per identity. Derived from the pathname, never stored. */
export type PageIdentity =
  | { kind: 'dashboard'; uid: string }
  | { kind: 'explore' }
  | { kind: 'alerting'; pathname: string }
  | { kind: 'app'; pathname: string };

export type PageHistoryKind = PageIdentity['kind'];

export type PageHistoryEntry = PageIdentity & {
  /** Newest `pathname + search` seen for this page, base-url-less (as `locationService.getLocation()` reports it). */
  href: string;
  /** Epoch ms of the last visit or in-page URL update. */
  lastVisited: number;
  /** What the page last put in the chrome (the browser-tab title); absent until the page sets its nav. */
  title?: string;
};
