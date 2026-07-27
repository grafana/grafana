export const DEFAULT_SORT = { label: 'A\u2013Z', value: 'alpha-asc' };
export const SECTION_STORAGE_KEY = 'search.sections';
export const GENERAL_FOLDER_UID = 'general';
export const GENERAL_FOLDER_TITLE = 'Dashboards';

/**
 * Returns true when `uid` identifies the synthetic root folder. Two sentinels
 * mean "root" across the codebase:
 *   - "" / undefined (legacy empty folder annotation)
 *   - "general" (canonical root UID)
 *
 * Mirrors the backend folder.IsRootFolderUID helper.
 */
export function isRootFolderUID(uid?: string): boolean {
  return !uid || uid === GENERAL_FOLDER_UID;
}

export const SEARCH_PANELS_LOCAL_STORAGE_KEY = 'grafana.search.include.panels';
export const SEARCH_SELECTED_LAYOUT = 'grafana.search.layout';
export const SEARCH_SELECTED_LAYOUT_DELETED = 'grafana.search.layout.recently-deleted';
export const SEARCH_SELECTED_SORT = 'grafana.search.sort';
export const SEARCH_SELECTED_SORT_DELETED = 'grafana.search.sort.recently-deleted';

export const RECENTLY_DELETED_SORT_VALUES = [
  'alpha-asc',
  'alpha-desc',
  'deleted-asc',
  'deleted-desc',
  'deletedby-asc',
  'deletedby-desc',
] as const;

export const TEAM_FOLDERS_UID = 'teamfolders';

export const STARRED_FOLDERS_UID = 'starred_folders';
