export const PAGE_HISTORY_KINDS = ['dashboard', 'explore', 'investigation', 'alerting', 'app'] as const;

export type PageHistoryKind = (typeof PAGE_HISTORY_KINDS)[number];

export interface PageHistoryEntry {
  /** Folds variants of one page: `dashboard:<uid>`, `investigation:<id>`, `explore`, or the pathname for alerting/app. */
  key: string;
  kind: PageHistoryKind;
  /** Newest `pathname + search` seen for this key, base-url-less (as `locationService.getLocation()` reports it). */
  href: string;
  /** Epoch ms of the last visit or in-page URL update. */
  lastVisited: number;
  /** Number of navigations onto this page (same-pathname URL churn does not count). */
  visits: number;
}

export const PAGE_HISTORY_MAX = 100;
export const DASHBOARD_KEY_PREFIX = 'dashboard:';
export const INVESTIGATION_KEY_PREFIX = 'investigation:';
