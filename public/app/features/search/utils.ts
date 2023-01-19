import { UrlQueryMap } from '@grafana/data';

import { SECTION_STORAGE_KEY } from './constants';
import { SearchState } from './types';

/**
 * Check if search query has filters enabled. Excludes folderId
 * @param query
 */
export const hasFilters = (query: SearchState) => {
  if (!query) {
    return false;
  }
  return Boolean(query.query || query.tag?.length > 0 || query.starred || query.sort);
};

/**
 * Get storage key for a dashboard folder by its title
 * @param title
 */
export const getSectionStorageKey = (title = 'General') => {
  return `${SECTION_STORAGE_KEY}.${title.toLowerCase()}`;
};

/**
 * Remove undefined keys from url params object and format non-primitive values
 * @param params
 * @param folder
 */
export const parseRouteParams = (params: UrlQueryMap) => {
  const cleanedParams = Object.entries(params).reduce((obj, [key, val]) => {
    if (!val) {
      return obj;
    } else if (key === 'tag' && !Array.isArray(val)) {
      return { ...obj, tag: [val] as string[] };
    } else if (key === 'sort') {
      return { ...obj, sort: { value: val } };
    }
    return { ...obj, [key]: val };
  }, {} as Partial<SearchState>);

  if (params.folder) {
    const folderStr = `folder:${params.folder}`;
    return {
      ...cleanedParams,
      query: `${folderStr} ${(cleanedParams.query ?? '').replace(folderStr, '')}`,
    };
  }

  return { ...cleanedParams };
};
