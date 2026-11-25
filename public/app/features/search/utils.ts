import { store, type UrlQueryMap } from '@grafana/data';

import { SECTION_STORAGE_KEY } from './constants';
import { type SearchState } from './types';

/** Cleans up old local storage values that remembered many open folders */
export const cleanupOldExpandedFolders = () => {
  const keyPrefix = SECTION_STORAGE_KEY + '.';

  for (const key of Object.keys(store.all(keyPrefix))) {
    store.delete(keyPrefix + key);
  }
};

/**
 * Remove undefined keys from url params object and format non-primitive values
 * @param params
 */
export const parseRouteParams = (params: UrlQueryMap) => {
  const cleanedParams = Object.entries(params).reduce<Partial<SearchState>>((obj, [key, val]) => {
    if (!val) {
      return obj;
    } else if (key === 'tag' && !Array.isArray(val)) {
      return { ...obj, tag: [val.toString()] };
    } else if (key === 'ownerReference' && !Array.isArray(val)) {
      return { ...obj, ownerReference: [val.toString()] };
    }

    return { ...obj, [key]: val };
  }, {});

  if (params.folder) {
    const folderStr = `folder:${params.folder}`;
    return {
      ...cleanedParams,
      query: `${folderStr} ${(cleanedParams.query ?? '').replace(folderStr, '')}`,
    };
  }

  return { ...cleanedParams };
};

/**
 * If we have filter, we can only show the results in the list layout as the tree layout does not work well
 */
export function needsListLayout(q: Partial<SearchState>) {
  return (
    q.query ||
    q.sort ||
    q.starred ||
    q.tag?.length ||
    q.createdBy ||
    q.ownerReference?.length ||
    q.panel_type ||
    q.datasource
  );
}
