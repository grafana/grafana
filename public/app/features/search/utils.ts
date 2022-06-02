import { UrlQueryMap } from '@grafana/data';

import { getDashboardSrv } from '../dashboard/services/DashboardSrv';

import { SECTION_STORAGE_KEY } from './constants';
import { SearchQuery } from './service';
import { DashboardQuery } from './types';

export async function replaceCurrentFolderQuery(query: SearchQuery): Promise<SearchQuery> {
  if (query.query && query.query.indexOf('folder:current') >= 0) {
    query = {
      ...query,
      location: await getCurrentFolderUID(),
      query: query.query.replace('folder:current', '').trim(),
    };
    if (!query.query?.length) {
      query.query = '*';
    }
  }
  return Promise.resolve(query);
}

/** utility function to parse the folder from URL */
async function getCurrentFolderUID(): Promise<string | undefined> {
  try {
    let dash = getDashboardSrv().getCurrent();
    if (!dash) {
      await delay(500); // may not be loaded yet
      dash = getDashboardSrv().getCurrent();
    }
    return Promise.resolve(dash?.meta?.folderUid);
  } catch (e) {
    console.error(e);
  }
  return undefined;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if search query has filters enabled. Excludes folderId
 * @param query
 */
export const hasFilters = (query: DashboardQuery) => {
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
  }, {} as Partial<DashboardQuery>);

  if (params.folder) {
    const folderStr = `folder:${params.folder}`;
    return {
      ...cleanedParams,
      query: `${folderStr} ${(cleanedParams.query ?? '').replace(folderStr, '')}`,
    };
  }

  return { ...cleanedParams };
};
