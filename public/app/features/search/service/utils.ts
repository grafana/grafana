import { DataFrameView, IconName, fuzzySearch } from '@grafana/data';
import { isSharedWithMe } from 'app/features/browse-dashboards/components/utils';
import { DashboardViewItemWithUIItems } from 'app/features/browse-dashboards/types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardDataDTO } from 'app/types/dashboard';

import { AnnoKeyFolder, ResourceList } from '../../apiserver/types';
import { DashboardSearchHit, DashboardSearchItemType, DashboardViewItem, DashboardViewItemKind } from '../types';

import { DashboardQueryResult, SearchQuery, SearchResultMeta } from './types';
import { SearchHit } from './unified';

/** prepare the query replacing folder:current */
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

export function getIconForKind(kind: string, isOpen?: boolean): IconName {
  if (kind === 'dashboard') {
    return 'apps';
  }

  if (kind === 'folder') {
    return isOpen ? 'folder-open' : 'folder';
  }

  if (kind === 'sharedwithme') {
    return 'users-alt';
  }

  return 'question-circle';
}

export function getIconForItem(item: DashboardViewItemWithUIItems, isOpen?: boolean): IconName {
  if (item && isSharedWithMe(item.uid)) {
    return 'users-alt';
  } else {
    return getIconForKind(item.kind, isOpen);
  }
}

function parseKindString(kind: string): DashboardViewItemKind {
  switch (kind) {
    case 'dashboard':
    case 'folder':
    case 'panel':
      return kind;
    default:
      return 'dashboard'; // not a great fallback, but it's the previous behaviour
  }
}

function isSearchResultMeta(obj: unknown): obj is SearchResultMeta {
  return obj !== null && typeof obj === 'object' && 'locationInfo' in obj;
}

export function queryResultToViewItem(
  item: DashboardQueryResult,
  view?: DataFrameView<DashboardQueryResult>
): DashboardViewItem {
  const customMeta = view?.dataFrame.meta?.custom;
  const meta: SearchResultMeta | undefined = isSearchResultMeta(customMeta) ? customMeta : undefined;

  const viewItem: DashboardViewItem = {
    kind: parseKindString(item.kind),
    uid: item.uid,
    title: item.name,
    url: item.url,
    tags: item.tags ?? [],
    managedBy: item.managedBy,
  };

  // Set enterprise sort value property
  const sortFieldName = meta?.sortBy;
  if (sortFieldName) {
    const sortFieldValue = item[sortFieldName];
    if (typeof sortFieldValue === 'string' || typeof sortFieldValue === 'number') {
      viewItem.sortMetaName = sortFieldName;
      viewItem.sortMeta = sortFieldValue;
    }
  }

  if (item.location) {
    const ancestors = item.location.split('/');
    const parentUid = ancestors[ancestors.length - 1];
    const parentInfo = meta?.locationInfo[parentUid];
    if (parentInfo) {
      viewItem.parentTitle = parentInfo.name;
      viewItem.parentKind = parentInfo.kind;
      viewItem.parentUID = parentUid;
    }
  }

  return viewItem;
}

export function resourceToSearchResult(resource: ResourceList<DashboardDataDTO>): SearchHit[] {
  return resource.items.map((item) => {
    const hit = {
      resource: 'dashboards',
      name: item.metadata.name,
      title: item.spec?.title,
      location: 'general',
      folder: item?.metadata?.annotations?.[AnnoKeyFolder] ?? 'general',
      tags: item.spec?.tags || [],
      field: {},
      url: '',
    };
    if (!hit.folder) {
      return { ...hit, location: 'general', folder: 'general' };
    }

    return hit;
  });
}

export function searchHitsToDashboardSearchHits(searchHits: SearchHit[]): DashboardSearchHit[] {
  return searchHits.map((hit) => {
    const dashboardHit: DashboardSearchHit = {
      type: hit.resource === 'folders' ? DashboardSearchItemType.DashFolder : DashboardSearchItemType.DashDB,
      title: hit.title,
      uid: hit.name, // k8s name is the uid
      url: hit.url,
      tags: hit.tags || [],
      isDeleted: true, // All results from trash are deleted
      sortMeta: 0, // Default value for deleted items
    };

    if (hit.folder && hit.folder !== 'general') {
      dashboardHit.folderUid = hit.folder;
    }

    return dashboardHit;
  });
}

/**
 * Filters search results based on query parameters
 * This is used when backend filtering is not available (e.g., for deleted dashboards)
 * Supports fuzzy search for tags and titles and alphabetical sorting
 */
export function filterSearchResults(
  results: SearchHit[],
  query: {
    query?: string;
    tag?: string[];
    sort?: string;
  }
): SearchHit[] {
  let filtered = results;

  if ((query.query && query.query.trim() !== '' && query.query !== '*') || (query.tag && query.tag.length > 0)) {
    const searchString = query.query || query.tag?.join(',') || '';
    const haystack = results.map((hit) => `${hit.title},${hit.tags.join(',')}`);
    const indices = fuzzySearch(haystack, searchString);
    filtered = indices.map((index) => results[index]);
  }

  if (query.sort) {
    const collator = new Intl.Collator();
    const mult = query.sort === 'alpha-desc' ? -1 : 1;
    filtered.sort((a, b) => mult * collator.compare(a.title, b.title));
  }

  return filtered;
}
