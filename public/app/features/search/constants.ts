import { DashboardSearchItemType } from './types';

export const NO_ID_SECTIONS = ['Recent', 'Starred'];
// Height of the search result item
export const SEARCH_ITEM_HEIGHT = 58;
export const SEARCH_ITEM_MARGIN = 8;
export const DEFAULT_SORT = { label: 'A\u2013Z', value: 'alpha-asc' };
export const SECTION_STORAGE_KEY = 'search.sections';
export const GENERAL_FOLDER_ID = 0;
export const GENERAL_FOLDER_UID = 'general';
export const GENERAL_FOLDER_TITLE = 'General';
export const SEARCH_PANELS_LOCAL_STORAGE_KEY = 'grafana.search.include.panels';
export const SEARCH_SELECTED_LAYOUT = 'grafana.search.layout';
export const SEARCH_SELECTED_SORT = 'grafana.search.sort';
export const TYPE_KIND_MAP: { [key: string]: DashboardSearchItemType } = {
  dashboard: DashboardSearchItemType.DashDB,
  folder: DashboardSearchItemType.DashFolder,
  home: DashboardSearchItemType.DashHome,
};

export const DEFAULT_MAX_VALUES = 1000;
