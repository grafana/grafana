import { type ManagedBy } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type DataFrame, type DataFrameView, type IconName, fuzzySearch } from '@grafana/data';
import { type DashboardViewItemWithUIItems } from 'app/features/browse-dashboards/types';
import {
  isSharedWithMe,
  isVirtualStarredFolder,
  isVirtualTeamFolder,
} from 'app/features/browse-dashboards/utils/dashboards';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { type ManagerKind } from '../../apiserver/types';
import { type DashboardViewItem, type DashboardViewItemKind } from '../types';

import { type DashboardQueryResult, type SearchQuery, type SearchResultMeta } from './types';
import { type SearchHit } from './unified';

/**
 * Marker stored in `field.deletedBy` when IAM lookup succeeded but the deleter UID had no
 * display entry — typically because the account (user, service account, API key, ...) was
 * deleted. Chosen with NUL delimiters so it cannot collide with any real display name.
 */
export const DELETED_BY_REMOVED = '\u0000__grafana_deleted_account__\u0000';

/**
 * Marker stored in `field.deletedBy` when the IAM batch containing the UID failed entirely
 * (network/timeout/server error). We cannot distinguish "account deleted" from "lookup failed"
 * for UIDs in a failed batch, so we surface the ambiguity in the UI with an icon + tooltip.
 */
export const DELETED_BY_UNKNOWN = '\u0000__grafana_unknown_account__\u0000';

export function formatDeletedByDisplayValue(
  rawValue: unknown,
  t: (key: string, defaultValue: string) => string
): string {
  if (rawValue === DELETED_BY_REMOVED) {
    return t('search.results-table.deleted-by-removed', 'Deleted account');
  }
  if (typeof rawValue === 'string' && rawValue) {
    return rawValue;
  }
  return '-';
}

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
    return 'user-arrows';
  }

  if (item && isVirtualStarredFolder(item.uid)) {
    return 'favorite';
  }

  if (item && isVirtualTeamFolder(item.uid)) {
    return 'users-alt';
  }

  return getIconForKind(item.kind, isOpen);
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

export function extractManagerKind(managedBy?: ManagedBy | ManagerKind): ManagerKind | undefined {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return typeof managedBy === 'string' ? managedBy : (managedBy?.kind as ManagerKind);
}

export function extractManagerId(managedBy?: ManagedBy | ManagerKind): string | undefined {
  return typeof managedBy === 'object' ? managedBy?.id : undefined;
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
    description: item.description,
    url: item.url,
    tags: item.tags ?? [],
    managedBy: extractManagerKind(item.managedBy),
    managerId: extractManagerId(item.managedBy),
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

/**
 * The deletion time of a search hit, or undefined when it carries none, which is the case
 * for an object deleted before deletion times were recorded.
 */
export function parseDeletionTimestamp(value: string | number | undefined | null): Date | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Date.parse(value);
  return isNaN(parsed) ? undefined : new Date(parsed);
}

/**
 * Orders hits by a key, putting those without one last whichever way the sort runs. Sorting
 * by a value an item does not have would otherwise place it arbitrarily.
 */
function absentLast<T>(
  key: (hit: SearchHit) => T | undefined,
  compare: (a: T, b: T) => number,
  mult: number
): (a: SearchHit, b: SearchHit) => number {
  return (a, b) => {
    const keyA = key(a);
    const keyB = key(b);
    if (keyA === undefined) {
      return keyB === undefined ? 0 : 1;
    }
    if (keyB === undefined) {
      return -1;
    }
    return mult * compare(keyA, keyB);
  };
}

/**
 * Filters search results based on query parameters
 * This is used when backend filtering is not available (e.g., for deleted dashboards)
 * Supports fuzzy search for tags and titles, alphabetical sorting, and deletion timestamp sorting
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
    if (query.sort === 'deleted-asc' || query.sort === 'deleted-desc') {
      const mult = query.sort === 'deleted-desc' ? -1 : 1;
      filtered.sort(
        absentLast(
          (hit) => parseDeletionTimestamp(hit.field.deletionTimestamp)?.getTime(),
          (a, b) => a - b,
          mult
        )
      );
    } else if (query.sort === 'deletedby-asc' || query.sort === 'deletedby-desc') {
      const collator = new Intl.Collator();
      const mult = query.sort === 'deletedby-desc' ? -1 : 1;
      // A missing or sentinel deleter value is not something to order by.
      const deleter = (hit: SearchHit): string | undefined => {
        const v = hit.field.deletedBy;
        return typeof v === 'string' && v !== DELETED_BY_REMOVED && v !== DELETED_BY_UNKNOWN ? v : undefined;
      };
      filtered.sort(absentLast(deleter, (a, b) => collator.compare(a, b), mult));
    } else {
      // Alphabetical sorting
      const collator = new Intl.Collator();
      const mult = query.sort === 'alpha-desc' ? -1 : 1;
      filtered.sort((a, b) => mult * collator.compare(a.title, b.title));
    }
  }

  return filtered;
}

/**
 * Appends rows from `frame` into `target`, aligning fields that may differ between frames.
 * New fields are backfilled with null for existing rows; missing fields are padded with null for new rows.
 */
export function appendFrame(target: DataFrame, frame: DataFrame): void {
  const existingLength = target.length;
  const newLength = existingLength + frame.length;

  // Add new fields from the incoming frame that don't exist in the target yet
  for (const f of frame.fields) {
    if (!target.fields.find((vf) => vf.name === f.name)) {
      target.fields.push({
        ...f,
        values: new Array(existingLength).fill(null).concat(f.values),
      });
    }
  }

  // Append values from matching fields
  for (const f of frame.fields) {
    const field = target.fields.find((vf) => vf.name === f.name);
    if (field && field.values.length === existingLength) {
      field.values.push(...f.values);
    }
  }

  // Pad fields that don't exist in the incoming frame with null
  for (const field of target.fields) {
    while (field.values.length < newLength) {
      field.values.push(null);
    }
  }

  target.length = newLength;
}
