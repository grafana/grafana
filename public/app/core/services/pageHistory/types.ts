/** What a visited URL resolves to; one history row per identity. Derived from the pathname, never stored. */
export type PageIdentity =
  | { kind: 'dashboard'; uid: string }
  | { kind: 'explore' }
  | { kind: 'investigation'; pluginId: string; id: string }
  | { kind: 'alerting'; pathname: string }
  | { kind: 'app'; pathname: string };

export type PageHistoryKind = PageIdentity['kind'];

export type PageHistoryEntry = PageIdentity & {
  /** Newest `pathname + search` seen for this page, base-url-less (as `locationService.getLocation()` reports it). */
  href: string;
  /** Epoch ms of the last visit or in-page URL update. */
  lastVisited: number;
};
