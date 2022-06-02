import { parse, SearchParserResult } from 'search-query-parser';

import { UrlQueryMap } from '@grafana/data';

import { getDashboardSrv } from '../dashboard/services/DashboardSrv';

import { SECTION_STORAGE_KEY } from './constants';
import { DashboardQuery } from './types';

export const parseQuery = (query: string) => {
  const parsedQuery = parse(query, {
    keywords: ['folder'],
  });

  if (typeof parsedQuery === 'string') {
    return {
      text: parsedQuery,
    } as SearchParserResult;
  }

  return parsedQuery;
};

/**
 * When search is done within a dashboard folder, add folder id to the search query
 * to narrow down the results to the folder
 * @param query
 * @param queryParsing
 */
export const getParsedQuery = (query: DashboardQuery, queryParsing = false) => {
  const parsedQuery = { ...query, sort: query.sort?.value };
  if (!queryParsing) {
    return parsedQuery;
  }

  let folderIds: number[] = [];

  if (parseQuery(query.query).folder === 'current') {
    try {
      const dash = getDashboardSrv().getCurrent();
      if (dash?.meta.folderId) {
        folderIds = [dash?.meta.folderId];
      }
    } catch (e) {
      console.error(e);
    }
  }
  return { ...parsedQuery, query: parseQuery(query.query).text as string, folderIds };
};

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
