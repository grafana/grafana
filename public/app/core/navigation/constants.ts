import { HOME_NAV_ID } from 'app/core/reducers/navModel';

/** Shown in the primary nav when the user has no saved layout. */
export const DEFAULT_PINNED_IDS = [
  HOME_NAV_ID,
  'dashboards/browse',
  'explore',
  'alerting',
] as const;

/** Never shown in overflow; cannot be unpinned. */
export const ALWAYS_PRIMARY_IDS = new Set([HOME_NAV_ID]);

/** Excluded from mega menu projection. */
export const MEGA_MENU_EXCLUDED_IDS = new Set(['profile', 'help', 'bookmarks']);

/** Cannot toggle pin state in the UI. */
export const UNPINNABLE_IDS = new Set([HOME_NAV_ID]);

export const SHOW_MORE_SECTION_ID = 'show-me-more';
